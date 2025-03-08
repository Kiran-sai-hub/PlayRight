import mongoose from "mongoose";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
    username:{
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,

    },
    email:{
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullname:{
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    avatar:{
        type: String, // Cloudinary Url.
        required: true,
    },
    coverImage: {
        type: String, // Cloudinary Url.
        
    },
    watchHistory: [
        {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        },
    ],
    password: {
        type: String,
        required: [true, 'Password is required'],
    },
    refreshToken:{
        type: String,

    }
}, {timestamps: true}); 
// Timestamps will gove you CreatedAt and UpdatedAt automatically once
// set to true..

userSchema.pre('save', async function(next){
    // doing Stuff!
    if(!this.isModified("password")){
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.isPasswordCorrect = async function(password){
    let result = await bcrypt.compare(password, this.password);
    return result;
};

userSchema.methods.generateAccessToken = function(){
    const token = jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullname: this.fullname,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
        }
    )
    return token;
};
userSchema.methods.generateRefreshToken = function(){
    const token = jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
        }
    )
    return token;
};


export const User = mongoose.model('User', userSchema);