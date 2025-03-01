import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { DB_NAME } from '../constants.js';
dotenv.config(); // configuring environement variables...

const url = `${process.env.DB_URL}/${DB_NAME}`;

const connectDB = async ()=>{
    try{
        await mongoose.connect(url);
        console.log("MongoDB Connected!!");
    }catch(err){
        console.log("MongoDB Connection Failed: ");
        console.log(err);
        process.exit(1);
    }
}

export default connectDB;