import 'dotenv/config';
import express from 'express';import mongoose from 'mongoose';import cors from 'cors';import bcrypt from 'bcryptjs';import jwt from 'jsonwebtoken';import crypto from 'node:crypto';
const app=express();
const allowedOrigins = [
  'http://localhost:5173',
  'https://event-registration-ticket-system.vercel.app'
];

app.use(cors({
  origin: allowedOrigins
}));

app.use(express.json());
const U=mongoose.model('User',new mongoose.Schema({name:String,email:{type:String,unique:true,lowercase:true},password:String,role:{type:String,enum:['admin','attendee'],default:'attendee'}}));
const E=mongoose.model('Event',new mongoose.Schema({title:{type:String,required:true},description:String,category:String,venue:{type:String,required:true},date:{type:Date,required:true},capacity:{type:Number,required:true,min:1},booked:{type:Number,default:0}}));
const rs=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User'},event:{type:mongoose.Schema.Types.ObjectId,ref:'Event'},code:{type:String,unique:true},checkedIn:{type:Boolean,default:false}});rs.index({user:1,event:1},{unique:true});const R=mongoose.model('Registration',rs);
const wrap=f=>(req,res,next)=>Promise.resolve(f(req,res,next)).catch(next);
const safe=u=>({id:u.id,name:u.name,email:u.email,role:u.role});
const token=u=>jwt.sign({id:u.id},process.env.JWT_SECRET,{expiresIn:'7d'});
const auth=wrap(async(req,res,next)=>{try{const t=(req.headers.authorization||'').replace('Bearer ','');const d=jwt.verify(t,process.env.JWT_SECRET);req.user=await U.findById(d.id);if(!req.user)return res.status(401).json({message:'Login required'});next();}catch{return res.status(401).json({message:'Login required'});}});
const admin=(req,res,next)=>req.user.role==='admin'?next():res.status(403).json({message:'Admin only'});
app.get('/api/health',(req,res)=>res.json({status:'ok'}));
app.post('/api/auth/register',wrap(async(req,res)=>{const{name,email,password,role,adminCode}=req.body;if(!name?.trim()||!email?.includes('@')||!password||password.length<6)return res.status(400).json({message:'Enter name, email and password (6+ characters)'});if(role==='admin'&&(!process.env.ADMIN_CODE||adminCode!==process.env.ADMIN_CODE))return res.status(403).json({message:'Invalid admin code'});const u=await U.create({name:name.trim(),email:email.trim().toLowerCase(),password:await bcrypt.hash(password,10),role:role==='admin'?'admin':'attendee'});res.status(201).json({user:safe(u),token:token(u)});}));
app.post('/api/auth/login',wrap(async(req,res)=>{const u=await U.findOne({email:String(req.body.email||'').trim().toLowerCase()});if(!u||!await bcrypt.compare(String(req.body.password||''),u.password))return res.status(401).json({message:'Invalid credentials'});res.json({user:safe(u),token:token(u)});}));
app.get('/api/auth/me',auth,(req,res)=>res.json({user:safe(req.user)}));
app.get('/api/events',wrap(async(req,res)=>res.json(await E.find().sort({date:1}))));
app.post('/api/events',auth,admin,wrap(async(req,res)=>{const {title,description,category,venue,date,capacity}=req.body;if(!title?.trim()||!venue?.trim()||!date||new Date(date)<=new Date()||!Number.isInteger(Number(capacity))||Number(capacity)<1)return res.status(400).json({message:'Valid title, venue, future date and capacity required'});res.status(201).json(await E.create({title,description,category,venue,date,capacity:Number(capacity)}));}));
app.put('/api/events/:id',auth,admin,wrap(async(req,res)=>{const {title,description,category,venue,date,capacity}=req.body;if(!title?.trim()||!venue?.trim()||new Date(date)<=new Date()||!Number.isInteger(Number(capacity))||Number(capacity)<1)return res.status(400).json({message:'Invalid event'});const e=await E.findOneAndUpdate({_id:req.params.id,booked:{$lte:Number(capacity)}},{$set:{title,description,category,venue,date,capacity:Number(capacity)}},{new:true,runValidators:true});if(!e)return res.status(400).json({message:'Not found or capacity below tickets sold'});res.json(e);}));
app.delete('/api/events/:id',auth,admin,wrap(async(req,res)=>{const e=await E.findById(req.params.id);if(!e)return res.status(404).json({message:'Not found'});if(e.booked)return res.status(400).json({message:'Cannot delete event with tickets'});await e.deleteOne();res.json({message:'Deleted'});}));
app.post('/api/events/:id/register',auth,wrap(async(req,res)=>{if(req.user.role!=='attendee')return res.status(403).json({message:'Attendee account required'});if(await R.exists({user:req.user.id,event:req.params.id}))return res.status(409).json({message:'Already registered'});const e=await E.findOneAndUpdate({_id:req.params.id,date:{$gt:new Date()},$expr:{$lt:['$booked','$capacity']}},{$inc:{booked:1}},{new:true});if(!e)return res.status(400).json({message:'Event unavailable or full'});try{res.status(201).json(await R.create({user:req.user.id,event:e.id,code:'EVT-'+crypto.randomBytes(6).toString('hex').toUpperCase()}));}catch(err){await E.updateOne({_id:e.id},{$inc:{booked:-1}});throw err;}}));
app.get('/api/tickets',auth,wrap(async(req,res)=>res.json(await R.find({user:req.user.id}).populate('event').sort({_id:-1}))));
app.get('/api/admin/registrations/:id',auth,admin,wrap(async(req,res)=>res.json(await R.find({event:req.params.id}).populate('user','name email'))));
app.post('/api/admin/checkin',auth,admin,wrap(async(req,res)=>{const code=String(req.body.code||'').trim().toUpperCase();const t=await R.findOneAndUpdate({code,checkedIn:false},{$set:{checkedIn:true}},{new:true});if(t)return res.json({message:'Check-in successful'});res.status(404).json({message:'Ticket not found or already checked in'});}));
app.use((err,req,res,next)=>{console.error(err);res.status(err.code===11000?409:400).json({message:err.code===11000?'Already exists':err.message||'Request failed'});});
if(!process.env.MONGO_URI||!process.env.JWT_SECRET)throw Error('Configure backend/.env');
mongoose.connect(process.env.MONGO_URI).then(()=>app.listen(process.env.PORT||5000,()=>console.log('API running on port '+(process.env.PORT||5000)))).catch(console.error);
