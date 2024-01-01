const express = require('express');
const mongodb = require('mongodb');
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

dotenv.config();
// var MongoClient = mongodb.MongoClient;
var url = "mongodb://localhost:27017/coursesApp";
const jwtSecretKeyAdmin = process.env.JWT_SECRET_KEY_ADMIN;
const jwtSecretKeyUser = process.env.JWT_SECRET_KEY_USER




mongoose.connect(url)
.then(console.log("Database connected successfully!!"))
.catch(err => {`failed to connect : ${err}`});

const app = express();
app.use(bodyParser.json());

// DB Schemas and Models

// admin schema and model
const adminSchema = mongoose.Schema({
  username : String,
  password: String
})
const adminModel = mongoose.model("AdminModel", adminSchema);  // admin model

// admin Courses Schema and model
const adminCourse = mongoose.Schema({
  title : String,
  description: String,
  price: Number,
  imageLink: String,
  published: Boolean
})
const adminCourseModel = mongoose.model("AdminCourses", adminCourse);

// User Schema and model

const userSchema = mongoose.Schema({
  username : String,
  password: String,
  purchasedCourses : [{type : mongoose.Schema.Types.ObjectId, ref: 'AdminCourses'}]
});
const userModel = mongoose.model("Users", userSchema);


/*
  Middleware to verify jwt tokens
*/
const httpLinkPattern = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)[a-zA-Z0-9]+([\-\.]{1}[a-zA-Z0-9]+)*\.[a-zA-Z]{2,5}(:[0-9]{1,5})?(\/.*)?$/;

const middleware = {

  authenticateAdminToken : (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if(token == null){
      return res.status(401)
    }
    jwt.verify(token, jwtSecretKeyAdmin, (err, user) => {
      if(err){
        return res.status(403).send("Token is not Valid or has already expired!!")
      }
      next();
    })
  },
  authenticateUserToken : (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if(token == null){
      return res.status(401)
    }
    jwt.verify(token, jwtSecretKeyUser, (err, user) => {
      if(err){
        return res.status(403).send("Token is not Valid or has already expired!!")
      }
      req.user = user
      next();
    })
  },
  verifyCourseDetails : (req, res, next) => {
    const courseTitle = req.body.title;
    const courseDescription = req.body.description;
    const coursePrice = req.body.price;
    const imgLink = req.body.imageLink;

    if(courseTitle.trim() == "" || courseTitle == null || courseTitle === undefined){
      return res.status(401).send("Invalid course title")
    }else if(courseDescription.trim() == "" || courseDescription == null || courseDescription === undefined){
      return res.status(401).send("Invalid course description")
    }else if(coursePrice < 0 || coursePrice == null || coursePrice === undefined){
      return res.status(401).send("Invalid course price")
    }else if(imgLink.trim() == "" || imgLink == null || imgLink === undefined || !httpLinkPattern.test(imgLink)){
      return res.status(401).send("Invalid course link")
    }
    next();
  }

}




/*
  API/Routes
*/

// Admin routes
app.post('/admin/signup', async (req, res) => {
  const userName = req.body.username;
  const pwd = req.body.password
  const userCreated = {
    user : userName,
    pwd : pwd
  }

  if(userName === " " || userName === undefined || (await adminModel.findOne({username: userName}))) {
    res.status(403).send("User already exists!!, try a different username.");
    return;
  }
  const am = new adminModel({
    username : userName,
    password: pwd
  });
  try{
    await am.save();
    // const jwtToken = jwt.sign(userCreated, jwtSecretKeyAdmin, {expiresIn: "2m"})
    res.status(200).send(`User Created Successfully!!`);
  }catch(error){
    console.error("Error saving user:", error);
    res.status(500).send("Internal Server Error");
  }
  
});

app.post('/admin/login', async (req, res) => {
  const username = req.headers.username;
  const password = req.headers.password;

  if(username == null || username.trim() == "" || username === undefined || password == null || password.trim() == "" || password == undefined){
    return res.status(401).send("Invalid Credentials");
  } else if (!(await adminModel.findOne({username: username, password: password}))){
    return res.status(401).send("User does not exists");
  }else{
    const userLoggedIn = {
      user : username,
      pwd : password
    };
    const jwtToken = jwt.sign(userLoggedIn, jwtSecretKeyAdmin, {expiresIn : "1h"});
    return res.status(200).send(jwtToken);
  }
});

app.post('/admin/courses', [middleware.authenticateAdminToken, middleware.verifyCourseDetails], async (req, res) => {

  const courseTitle = req.body.title;
  const courseDescription = req.body.description;
  const coursePrice = req.body.price;
  const imgLink = req.body.imageLink;
  const published = req.body.published;


  const course = new adminCourseModel({
    title : courseTitle,
    description : courseDescription,
    price : coursePrice,
    imageLink : imgLink,
    published: published
  })

  try {
    const savedCourse = await course.save();
    res.status(200).json({
      message: "Course Added successfully!",
      id: savedCourse._id
    });
  } catch (err) {
    console.log(`Course could not be added: ${err}`);
    res.status(500).send("Could not add the course");
  }
});

app.put('/admin/courses/:courseId', [middleware.authenticateAdminToken, middleware.verifyCourseDetails], async (req, res) => {
  const courseId = req.params.courseId;
  const courseTitle = req.body.title;
  const courseDescription = req.body.description;
  const coursePrice = req.body.price;
  const imgLink = req.body.imageLink;
  const published = req.body.published; 
  try{
    let course = await adminCourseModel.findById({_id : courseId})
    if(course !== null){
      course.title = courseTitle;
      course.description = courseDescription;
      course.price = coursePrice;
      course.imageLink = imgLink;
      course.published = published;
      try {
        await course.save();
        res.status(200).json({
          message: "Course Updates Successfully!!"
        })
      }catch(err) {
        console.log(err);
        res.status(500).send("Could not update course details");
      }
    }else{
      res.status(401).send("Invalid Course Id");
    }
  }catch(err){
    console.error(err);
    if (err.name === 'CastError') {
      return res.status(400).send("Invalid Course Id format");
    }
    return res.status(500).send("Could not update course details");
  }

});

app.get('/admin/courses', middleware.authenticateAdminToken, async  (req, res) => {

  try{
    const allCourses = await adminCourseModel.find({});
    const output = {
    courses : allCourses};
    res.status(200).send(output);
  }
  catch(err){
    console.log(err);
    res.send(500).status("Some error occured while fetching all courses");
  }
  
});

// User routes
app.post('/users/signup', async (req, res) => {
  const userName = req.body.username;
  const pwd = req.body.password;
  const userCreated = {
    username : userName,
    password : pwd
  }

  if(userName === " " || userName === undefined || (await userModel.findOne({username: userName}))) {
    res.status(403).send("User already exists!!, try a different username.");
    return;
  }
  const um = new userModel(userCreated);
  try{
    await um.save();
    res.status(200).send(`User Created Successfully!!`);
  }catch(error){
    console.error("Error saving user:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post('/users/login', async (req, res) => {
  const username = req.headers.username;
  const password = req.headers.password;

  if(username == null || username.trim() == "" || username === undefined || password == null || password.trim() == "" || password == undefined){
    return res.status(401).send("Invalid Credentials");
  } else if (!(await userModel.findOne({username: username, password: password}))){
    return res.status(401).send("User does not exists");
  }else{
    const userLoggedIn = {
      user : username,
      pwd : password
    };
    const jwtToken = jwt.sign(userLoggedIn, jwtSecretKeyUser, {expiresIn : "1h"});
    return res.status(200).send(jwtToken);
  }
});

app.get('/users/courses', middleware.authenticateUserToken , async (req, res) => {
  try{
    const courseList = await adminCourseModel.find({published:true});
    const output = {courses : courseList}
    res.status(200).send(output);
  }catch(err){
    console.log(err);
    res.status(500).send("Could not fetch courses")
  }
});

app.post('/users/courses/:courseId', middleware.authenticateUserToken,  async (req, res) => {
  const courseId = req.params.courseId;
  try{
    const user = await userModel.findOne({username : req.user.user});
    const course = await adminCourseModel.findById(courseId);
    if(course){
      user.purchasedCourses.push(course);
      await user.save();
      res.status(200).json({ message: 'Course purchased successfully' });
    }else{
      res.status(404).send("Course Not found!!");
    }
  }catch(err){
    console.log(err);
    res.status(500).send("Some error occurred while purchasing the course");
  }
  
});

app.get('/users/purchasedCourses', middleware.authenticateUserToken, async (req, res) => {
  const username = req.user.user;
  try {
    const user = await userModel.findOne({username : username}).populate('purchasedCourses');
    if(user.purchasedCourses){
      res.status(200).json({
        purchasedCourses: user.purchasedCourses
      })
    }else{
      res.status(200).json({
        purchasedCourses: []
      })
    }
  }catch(err){
    console.log(err);
    res.send(500).send("Some error occurred while fetching purchased courses")
  }
  
});

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
