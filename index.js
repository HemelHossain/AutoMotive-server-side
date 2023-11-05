const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const jwt = require('jsonwebtoken');
app.use(cors({
    origin: 'https://automotive-car-d90a6.web.app'
}));

app.use(express.json());
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);


const port = process.env.PORT || 5000;

            //   Creating user Token Checking 
const verifyJwt = (req, res, next) =>{
    const authorization = req.headers.authorization;
    if(!authorization){
        return res.status(401).send({error: true, message: 'UnAuthorized Access'})
    }
    const token = authorization.split(' ')[1];
    
    jwt.verify(token, process.env.private_Key, (error, decoded) =>{
        if(error){
            return res.status(401).send({error: true, message: 'UnAuthorized Access'})
        }
        req.decoded = decoded;
        next();
    })

}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.na7oygr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    const carCollection = client.db('AutoMotiveDb').collection('Cars');
    const reviewCollection = client.db('AutoMotiveDb').collection('review');
    const usersCollection = client.db('AutoMotiveDb').collection('users');
    const cartsCollection = client.db('AutoMotiveDb').collection('carts');
    const paymentCollection = client.db('AutoMotiveDb').collection('payments');

                    //    creating admin verify 
    const verifyAdmin = async(req, res, next) =>{
        const email= req.decoded.email;
        const query = {email: email};
        const user = await usersCollection.findOne(query);
        if(user?.role !== 'admin'){
            return res.status(403).send({error: true, message: 'Forbidden access'});
        }
        next();
    }
    
                //  JWT token Adding 
    app.post('/jwt', async(req, res) =>{
        const email = req.body;
        const token = jwt.sign(email, process.env.private_Key, {expiresIn: '1hr'});
        res.send(token);

    })
                 //  Cars releated Data 
    app.get('/cars', async(req, res) =>{
        const result =await carCollection.find().toArray();
        res.send(result);
    });

    app.post('/cars',verifyJwt, verifyAdmin, async(req, res) =>{
        const carItem = req.body;
        const result =await carCollection.insertOne(carItem);
        res.send(result);
    });

    app.delete('/cars/:id',verifyJwt, verifyAdmin, async(req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result =await carCollection.deleteOne(query);
        res.send(result);
    })


            //    Review Releated Data 

    app.get('/review', async(req, res) =>{
        const result =await reviewCollection.find().toArray();
        res.send(result);
    });

    app.post('/review',verifyJwt, async(req, res) =>{
        const reviewInfo = req.body;
        const result =await reviewCollection.insertOne(reviewInfo);
        res.send(result);
    });


                   // User Releated Data

    app.get('/users', verifyJwt, verifyAdmin, async(req, res) =>{
        const result = await usersCollection.find().toArray();
        res.send(result);
    });

    app.post('/users', async(req, res) =>{
        const user = req.body;
        const query = {email: user.email}
        const existingUser = await usersCollection.findOne(query);
        if(existingUser){
            return res.send({message: 'User already exist'});
        }
        else{
            const result =await usersCollection.insertOne(user);
            res.send(result);
        }
        
    })
                //    Verify the Admin 
    app.get('/users/admin/:email',verifyJwt, async(req, res) =>{
        const email = req.params.email;
        if(req.decoded.email !== email){
            res.send({admin: false});
        }
        const query = {email: email};
        const user = await usersCollection.findOne(query);
        const result = {admin: user.role === 'admin'};
        res.send(result);
    } )
                        //   Make user Admin 
    app.patch('/users/:id',verifyJwt, verifyAdmin,  async(req, res) =>{
        const id = req.params.id;
        const query = { _id: new ObjectId(id)};
        const updateDoc ={
            $set: {
                role: 'admin'
            }
        }
        const result =await usersCollection.updateOne(query ,updateDoc);
        res.send(result);
    })
                        
    app.delete('/users/:id',verifyJwt, verifyAdmin, async(req, res) =>{
        const id = req.params.id;
        const query = { _id: new ObjectId(id)};
        const result = await usersCollection.deleteOne(query);
        res.send(result); 
    })
                    //  User Cart data 
    app.get('/carts',verifyJwt, async(req, res) =>{

        const email = req.query.email;
        if(!email){
            res.send([])
        }
        const decodedEmail = req.decoded.email;
        if(email !== decodedEmail){
            res.status(403).send({error: true, message: 'Forbidden Access'})
        }
        const query = {email: email};
        const result =await cartsCollection.find(query).toArray();
        res.send(result);

    })
                 
    app.post('/carts',verifyJwt, async(req, res) =>{
        const cart = req.body;
        const result = await cartsCollection.insertOne(cart);
        res.send(result);

    })
            
    app.delete('/carts/:id',verifyJwt ,async(req, res) =>{
        const id = req.params.id;
        const query ={_id: new ObjectId(id)};
        const result = await cartsCollection.deleteOne(query);
        res.send(result);

    })
                    //   Purchase page data loading 
    app.get('/purchase/:id', async(req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const service = await carCollection.findOne(query);
        res.send(service);
    });
                    //   Payment releated data 
    app.post("/create-payment-intent",verifyJwt, async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ['card']
        });
      
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      });

      app.post('/payment', verifyJwt, async(req, res) =>{
        const payment = req.body;
        const insertResult = await paymentCollection.insertOne(payment);
        const query = {_id: {$in: payment.cartsItem.map(id => new ObjectId(id))}};
        const deleteUser = await cartsCollection.deleteMany(query);
        res.send({insertResult, deleteUser});
      })
                        // Admin Handle All Orders 
                        
      app.get('/allorders', verifyJwt, verifyAdmin, async(req, res) =>{
        const result = await paymentCollection.find().toArray();
        res.send(result);
    })
                        
    app.patch('/allorders/:id', verifyJwt, verifyAdmin, async(req, res) =>{
        const id = req.params.id;
        const {status} = req.body;
        const query = {_id: new ObjectId(id)};
        const updateDoc ={
            $set: {
                status: status
            }
        };
        const result = await paymentCollection.updateOne(query, updateDoc);
        res.send(result);

    })

    app.delete('/allorders/:id', verifyJwt, verifyAdmin, async(req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await paymentCollection.deleteOne(query);
        res.send(result);
    })
                        //  User Order 
    app.get('/myorder', verifyJwt, async(req, res) =>{
        const email = req.query.email;
        if(!email){
            res.send([]);
        }
        if(email !== req.decoded.email){
            res.status(403).send({error: true, message: 'Forbidden Access'});
        }
        const query = {email: email};
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
    })


    await client.db("admin").command({ ping: 1 });

    


    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) =>{
    res.send('automotive is running')
})

app.listen(port, () =>{
    console.log(`automotive is running, ${port}`);
})
