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
const jwtSecretKey = process.env.JWT_SECRET_KEY;




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

/*
  Middleware to verify jwt tokens
*/
const httpLinkPattern = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)[a-zA-Z0-9]+([\-\.]{1}[a-zA-Z0-9]+)*\.[a-zA-Z]{2,5}(:[0-9]{1,5})?(\/.*)?$/;

const middleware = {

  authenticateToken : (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if(token == null){
      return res.status(401)
    }
    jwt.verify(token, jwtSecretKey, (err, user) => {
      if(err){
        return res.status(403).send("Token is not Valid or has already expired!!")
      }
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
    // const jwtToken = jwt.sign(userCreated, jwtSecretKey, {expiresIn: "2m"})
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
    const jwtToken = jwt.sign(userLoggedIn, jwtSecretKey, {expiresIn : "1h"});
    return res.status(200).send(jwtToken);
  }
});

app.post('/admin/courses', [middleware.authenticateToken, middleware.verifyCourseDetails], async (req, res) => {

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

app.put('/admin/courses/:courseId', [middleware.authenticateToken, middleware.verifyCourseDetails], async (req, res) => {
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

app.get('/admin/courses', middleware.authenticateToken, async  (req, res) => {

  try{
    const allCourses = await adminCourseModel.find();
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
app.post('/users/signup', (req, res) => {
  // logic to sign up user
});

app.post('/users/login', (req, res) => {
  // logic to log in user
});

app.get('/users/courses', (req, res) => {
  // logic to list all courses
});

app.post('/users/courses/:courseId', (req, res) => {
  // logic to purchase a course
});

app.get('/users/purchasedCourses', (req, res) => {
  // logic to view purchased courses
});

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
