import { Request, Response,NextFunction } from "express";
import blogModal from "../Models/challengeModal";
import multer, { diskStorage } from "multer";
import path from "path";
import { io } from "..";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import subscribeModal from "../Models/subscribeModal";
import nodemailer from "nodemailer"
import { DecodedUserPayload } from "../middleWare/verifyToken";
 interface AuthenticatedRequest extends Request {
    user?:DecodedUserPayload; 
}
dotenv.config();
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});
const storage = diskStorage({
  filename: (req: Request, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage: storage,
}).single('imageUrl');

interface AuthenticatedRequest extends Request {
  token?: string;
}

export const createBlog = async (req: Request, res: Response) => {
	upload(req, res, async (err) => {
	  if (err) {
		return res.status(500).json({ message: "Error uploading file", error: err });
	  }
  
	  try {
		const { title, headline, content } = req.body;
		const author = req.body.author || "admin";
		const imageUrl = req.file?.path;
  
		if (!title || !headline || !content || !imageUrl) {
		  return res.status(400).json({ message: "Title, headline, content, and image are required" });
		}
  
		const result = await cloudinary.uploader.upload(imageUrl, { folder: "uploads" });
  
		const BlogData = new blogModal({
		  title,
		  headline,
		  content,
		  imageUrl: result.secure_url,
		  createdAt: Date.now(),
		  views: [],
		  likes: [],
		  shares: [],
		  comment: [],
		});
  
		const blogs: any = await BlogData.save();
  
		if (blogs) {
		 
		  const selectEmails: any = await subscribeModal.find();
		  if (selectEmails.length > 0) {
			const transporter = nodemailer.createTransport({
			  host: "smtp.gmail.com",
			  port: 465,
			  secure: true,
			  auth: {
				user: process.env.ADMIN_EMAIL,
				pass: process.env.ADMIN_PSWD,
			  },
			  tls: {
				rejectUnauthorized: false,
			  },
			});
  
			try {
			  const emails = selectEmails.map((emailData: any) => {
				return transporter.sendMail({
				  from: process.env.ADMIN_EMAIL,
				  to: emailData.email,
				  subject: "New Challenge Added",
				  html: `
					<div style="font-family: Arial, sans-serif; margin: 0; padding: 10px; background-color: #f4f4f4;">
					  <div style="max-width: 600px; margin: 20px auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
						<h1 style="color: #333;">New challenge  Notification</h1>
						<img src="${BlogData.imageUrl}" alt="Blog Image" style="width: 100%; max-width: 400px; height: auto; margin-bottom: 20px; border-radius: 5px;">
						<h2 style="font-size: 24px; margin-bottom: 10px;">${BlogData.title}</h2>
						<p style="color: #666;">Hello there!</p>
						<p style="color: #666;">We're excited to inform you that a new challenge post has been added to our website.</p>
						<p style="color: #666;">Check it out now:</p>
						<a href="https://jeanpierreportfolio.netlify.app/openedblog?id=${blogs._id}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Read challenge here</a>
						<p style="color: #666;">If you have any questions or feedback, feel free to reply to this email.</p>
						<p style="color: #666;">Thank you for being a valued subscriber!</p>
						<p style="color: #666;">Best Regards,<br>Umurava Tech</p>
					  </div>
					</div>
				  `,
				});
			  });
  
			 
			  await Promise.all(emails);
  
			  return res.status(201).json({ status: 'success', message: 'Notifications sent to all subscribers' ,blogs});
			} catch (emailError) {
			  console.error("Error sending emails:", emailError);
			  res.status(500).json({ message: 'Error sending notifications to subscribers', error: emailError });
			}
		  }
		}
	  } catch (error) {
		console.error("Error creating blog:", error);
		res.status(500).json({ message: 'Error creating blog', error });
	  }
	});
  };
  

export const getBlogs = async (req: Request, res: Response) => {
  
	try {
	  const blogData = await blogModal.find().sort({ _id: -1 });
  
	  if (blogData.length > 0) {
		return res.status(200).json({ message: "Success", blog: blogData });
	  } else {
		return res.status(404).json({ message: "No blogs available" });
	  }
	} catch (error: any) {
	  return res.status(500).json({ message: "Internal server error", error: error.message });
	}
}

export const getSingleBlog = async ( req: Request,res: Response)=>{
  try {

    const {id} = req.params
    const blog = await blogModal.findById(id)
    if(blog){
      res.status(200).json({blog: blog})
    }else{
      res.status(404).json({message:"no blog available"})
    }
    
  } catch (error:any) {
    res.status(500).json({ message: error.message });
    
  }
}

export const deleteBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const deleteD = await blogModal.findByIdAndDelete(id,{new:true});
    if(deleteD){
      res.status(200).json({
        message:"Blog Delete successfully",
      })
    }
    if (!deleteD) {
      res.status(404).json({ message: "No blog found" });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateBlog = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const checkBlog = await blogModal.findById(id);
    if (!checkBlog) {
      return res.status(404).json({ message: "Blog post not found" });
	}
    upload(req, res, async (err) => {
      if (err) {
        return res.status(500).json({ message: "Error uploading file", error: err });
      }

      const { title, headline, content } = req.body;
      const imageUrl: any = req.file?.path;
      let updateData: any = { title, headline, content };
      if (imageUrl) {
        try {
          const result = await cloudinary.uploader.upload(imageUrl, { folder: "uploads" });
          updateData.imageUrl = result.secure_url; 
        } catch (cloudinaryError) {
          return res.status(500).json({ message: "Error uploading image to Cloudinary", error:err.message });
        }
      }

      const updatedBlog = await blogModal.findByIdAndUpdate(id, updateData, { new: true });
      if (updatedBlog) {
        return res.status(200).json({ message: "Blog updated successfully", updatedBlog });
      } else {
        return res.status(404).json({ message: "Blog post not found for updating" });
      }
    });
  } catch (error: any) {
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



export const addLike = async(req:AuthenticatedRequest,res:Response)=>{
  try {
    const userId=req.user?.userId 
    const blogId=req.params.blogId
    const blogToLike:any = await blogModal.findById(blogId)
   
 
  if(!blogToLike){
    return res.status(404).json({success:false ,message:'blog not found'})
  }
  
  const index=blogToLike.likes.indexOf(userId)
     if(index !==-1){
         blogToLike.likes.splice(index,1)
          await blogToLike.save()
        io.emit("like added", { blogId, likes: blogToLike.likes });
        return  res.status(200).json({success:true ,message:'user has unliked blog'})

     }
     else{
     blogToLike.likes.push(userId)
      await blogToLike.save()
      io.emit("like removed", { blogId, likes: blogToLike.likes });
    return res.status(200).json({success:true ,message:'Like added to blog successfully'})
    
     }
    
  } 
  catch (error:any) {
    return res.status(500).json({messsage:'internal server',error})
    
  }
}


export const addComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {blogId}=req.params
    const {author,content}=req.body
    const blog= await blogModal.findById(blogId)
    if(!blog){
      res.status(404).json({message:'blog not found'})
    }
    const newcomment:any= {content,author}
    blog?.comment.push(newcomment)
    await blog?.save()
    res.status(200).json({message:'Comment added successfully',comment:newcomment})
    
  } catch (error) {
    res.status(500).json({message:'internal server error',error})
  }
};
