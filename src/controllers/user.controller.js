import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiErrors.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js"; 
import uploadOnCloudinary from "../utils/cloudinary.js"
import jwt from 'jsonwebtoken';


const generateAccessAndRefreshTokens = async(userId) => {
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken};

    }catch(err){
        throw new ApiError(500, "Something went wrong while generating refresh and access tokens");
    }
}


const registerUser = asyncHandler(async (req, res, next)=>{
    const {username, fullname, email, password} = req.body;
    if([fullname, username, email, password].some(
        (field)=> field?.trim() === ""
    )){
        throw new ApiError(400,"All Fields are Required");
    };

    const existedUser = await User.findOne({
        $or: [{ email }, { username }],
    });

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists");
    };

    const avatarLocalPath = req.files?.avatar[0]?.path;

    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) 
        && req.files.coverImage.length > 0){
            coverImageLocalPath  = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar is Required");
    }

    const user = await User.create({
        username: username.toLowerCase(),
        email: email,
        fullname: fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password: password,
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken",
    );

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registration");
    };

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered successfully"),
    );
});

const loginUser = asyncHandler(async(req,res,next) => {

    const { email, username, password } = req.body;
    if(!(username || email)){
        throw new ApiError(400, "Username or password is Required");
    };

    const user = await User.findOne({
        $or: [{username}, {email}],
    });
    if(!user){
        throw new ApiError(404, "User does not exist");
    };

    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid User credentials");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken",
    );

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken,
            },
            "User loggedIn successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res,next) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {refreshToken: 1},
        },
        {new: true}
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out")
    );
});

const refreshAccessToken = asyncHandler(async(req, res, next) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        new ApiError(401, "Unauthorized access");
    }

    try{
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        );
    
        const user = await User.findById(decodedToken._id);
        if(!user){
            throw new ApiError(401, "Invalid refresh Token");
        };
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token expired or already used!");
        };
    
        const options = {
            httpOnly: true,
            secure: true,
        };
    
        const { accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access Token refreshed"
            )
        );
    }catch(err){
        throw new ApiError(401, err?.message || "Invalid refresh Token")
    }
});

const changeCurrentPassword = asyncHandler(async(req,res,next) => {
    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await User.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid Password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed Successfully")
    );
});

const getCurrentUser = asyncHandler(async(req, res, next) => {
    return res.status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "Fetched current loggedIn user",
        )
    );
});

const updateAccountDetails = asyncHandler(async(req,res,next) => {
    // we will only allow fullname and email to be updated...
    const {fullname, email} = req.body;
    if(!fullname || !email){
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname: fullname,
                email: email,
            }
        },
        {new: true}
    ).select("-password -refreshToken");

    return res.status(200)
    .json(
        new ApiResponse(
            200, 
            user,
            "Updated Account details",
        )
    );
});

const updateUserAvatar = asyncHandler(async(req,res,next) => {

    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            }
        },
        {new: true}
    ).select("-password -refreshToken");

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Avatar updated Successfully"
        )
    );
});

const updateUserCoverImage = asyncHandler(async(req,res,next) => {

    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath){
        throw new ApiError(400, "CoverImage file is missing");
    }

    const coverImage = await uploadOnCloudinary(avatarLocalPath);
    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading Cover image");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            }
        },
        {new: true}
    ).select("-password -refreshToken");

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Cover Image updated Successfully"
        )
    );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
};