const express=require('express');
const router=express.Router();
const passport=require('passport');
const async = require('async');
const nodemailer = require('nodemailer');
const crypto=require('crypto')
const User=require('../models/usermodel')
const Product=require('../models/productmodel');


// Checks if user is authenticated
function isAuthenticatedUser(req, res, next) {
    if(req.isAuthenticated()) {
        return next();
    }
    req.flash('error_msg', 'Please Login first to access this page.')
    res.redirect('users/login');
}

//Get Routes
router.get('/',(req,res)=>{
    res.render('users/index')
})

router.get('/login',(req,res)=>{
    res.render('users/login')
})

router.get('/signup',(req,res)=>{
    res.render('users/signup')
})

//Rendering all products from users
router.get('/announcements',(req,res)=>{
  Product.find({})
  .then((products) => {
    res.render("users/announcements", { products: products });
  })
  .catch((error) => {
    req.flash("error_msg", "ERROR:" + error);
    res.redirect("/announcements");
  });
})


router.get('/logout',isAuthenticatedUser,(req,res)=>{
    req.logOut();
    req.flash('success_msg', 'You have been logged out.');
    res.redirect('/login');
})

router.get('/forgotpassword',(req,res)=>{
    res.render('users/forgotpassword')
})

//reset password of the current User
router.get("/reset/:token",(req, res) => {
  User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  })
    .then((user) => {
      if (!user) {
        req.flash(
          "error_msg",
          "Password reset token is invalid or has been expired."
        );
        res.redirect("/forgotpassword");
      }
      res.render("users/newpassword", {
        token: req.params.token,
      });
    })
    .catch((error) => {
      req.flash("error_msg", "Error:" + error);
      res.redirect("/forgotpassword");
    });
});

router.get('/password/change',(req,res)=>{
  res.render('users/changepassword')
})

//Post Routes

//login
router.post('/login', passport.authenticate('local', {
    successRedirect : 'dashboard',
    failureRedirect : 'login',
    failureFlash: 'Invalid email or password. Try Again!!!'
}));

//register
router.post('/signup',(req,res)=>{
    let {name,email,password}=req.body;
    let userData={
        name:name,
        email:email
    };
    User.register(userData,password,(error,data)=>{
        if(error){
            req.flash('error_msg', 'ERROR: '+error);
            res.redirect('/signup');
        }
        else if(userData.name.length<4 || password.length<4){
            req.flash('error_msg', 'Name or Password is too short. Please try again!');
            res.redirect('/signup');
        }
        passport.authenticate("local")(req, res, () => {
          req.flash("success_msg", "Account created successfully");
          res.redirect("/login");
        });
    });
});

//forgot password
router.post("/forgotpassword", (req, res, next) => {
  async.waterfall(
    [
      (done) => {
        crypto.randomBytes(20, (error, buffer) => {
          let token = buffer.toString("hex");
          done(error, token);
        });
      },
      (token, done) => {
        User.findOne({
          email: req.body.email,
        })
          .then((user) => {
            if (!user) {
              req.flash("error_msg", "User does not exist with this email.");
              return res.redirect("/forgotpassword");
            }
            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 1800000;

            user.save((error) => {
              done(error, token, user);
            });
          })
          .catch((error) => {
            req.flash("error_msg", "ERROR: " + error);
            res.redirect("/forgotpassword");
          });
      },
      (token, user) => {
        let smtpTransport = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: process.env.GMAIL_EMAIL,
            pass: process.env.GMAIL_PASSWORD,
          },
        });
        let mailOptions = {
          to: user.email,
          from: "Vipul Pal vipulpal@gmail.com",
          subject: "Recovery Email from Auth Project",
          text:
            "Please click the following link to recover your passoword: \n\n" +
            "http://" +req.headers.host +"/reset/" + token +"\n\n" +"If you did not request this, please ignore this email.",
        };
        smtpTransport.sendMail(mailOptions, (error) => {
          req.flash(
            "success_msg",
            "Email send with further instructions. Please check that."
          );
          res.redirect("/forgotpassword");
        });
      },
    ],
    (error) => {
      if (error) res.redirect("/forgotpassword");
    }
  );
});

//reset password
router.post("/reset/:token", (req, res) => {
    async.waterfall(
      [
        (done) => {
          User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() },
          })
            .then((user) => {
              if (!user) {
                req.flash(
                  "error_msg",
                  "Password reset token is invalid or has been expired."
                );
                res.redirect("/forgotpassword");
              }
              if (req.body.password !== req.body.confirmpassword) {
                req.flash("error_msg", "Password don't match.");
                return res.redirect("/forgotpassword");
              }
              user.setPassword(req.body.password, (error) => {
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
  
                user.save((error) => {
                  req.logIn(user, (error) => {
                    done(user, error);
                  });
                });
              });
            })
            .catch((error) => {
              req.flash("error_msg", "Error:" + error);
              res.redirect("/forgotpassword");
            });
        },
        (user) => {
          let smtpTransport = nodemailer.createTransport({
            service: "Gmail",
            auth: {
              user: process.env.GMAIL_EMAIL,
              pass: process.env.GMAIL_PASSWORD,
            },
          });
          let mailOptions = {
            to: user.email,
            from: "Vipulpal@gmail.com",
            subject: "Your Password is changed.",
            text: `Hello, ${user.name}\n\n This is the confirmation email that the password for your account ${user.email} has been changed . `,
          };
          smtpTransport.sendMail(mailOptions, (error) => {
            req.flash(
              "success_msg",
              "Your password has been changed successfully."
            );
            res.redirect("/login");
          });
        },
      ],
      (error) => {
        res.redirect("/login");
      }
    );
  });

 // change password
router.post("/password/change", (req, res) => {
  if (req.body.password !== req.body.confirmpassword) {
    req.flash("error_msg", "Password dont match. Try again.");
    return res.redirect("/password/change");
  }else if(req.body.password.length < 4 || req.body.confirmpassword < 4){
    req.flash("error_msg", "The password must be longer");
    return res.redirect("/password/change");
  }
  User.findOne({ email: req.user.email }).then((user) => {
    user.setPassword(req.body.password, (err) => {
      user
        .save()
        .then((user) => {
          req.flash("success_msg", "Password chanded succesfully");
          res.redirect("/dashboard");
        })
        .catch((error) => {
          req.flash("error_msg", "Error:"+error);
          res.redirect("/password/change");
        });
    });
  });
});

module.exports = router;
