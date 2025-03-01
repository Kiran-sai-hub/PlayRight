import dotenv from 'dotenv';
import connectDB from './db/config.js';
import app from './app.js';

dotenv.config({
    path: './env',
});

const PORT = process.env.PORT || 8000;

connectDB().then(()=>{
    app.listen(PORT, ()=>{
        console.log(`Server is running on Port: ${PORT}`);
    })
})
.catch((err)=>{
    console.log("MongoDB Connection Failure!!",err);
});