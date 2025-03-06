import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiErrors.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js"; 
import { uploadOnCloudinary } from "../utils/cloudinary.js"

const registerUser = asyncHandler(async (req, res, next)=>{
    const {username, fullname, email, password} = req.body;
    if([fullname, username, email, password].some(
        (field)=> field?.trim() === "")
    ){
        throw new ApiError(400,"All Fields are Required");
    };

    const existedUser = User.findOne({
        $or: [{ email }, { username }],
    });

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists");
    };

    console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

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
})

export {registerUser};