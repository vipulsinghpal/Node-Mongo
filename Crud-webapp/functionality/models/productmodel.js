const mongoose=require('mongoose');

let productScheme=new mongoose.Schema({
    imageUrl:{
        type:String,
        required:true
    },
    name:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    price:{
        type:Number,
        required:true
    },
    author:{
        type: String,
        required: true
    }
})
 module.exports = mongoose.model('Product', productScheme);