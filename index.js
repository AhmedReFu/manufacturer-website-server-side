const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uadfv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded
        console.log(req)
        next()
    })
}

async function run() {
    try {
        await client.connect();
        const productsCollection = client.db('pats_world').collection('products');
        const orderCollection = client.db('pats_world').collection('orders');
        const userCollection = client.db('pats_world').collection('users');
        const reviewCollection = client.db('pats_world').collection('review');

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        //AUTH
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ result, token })
        })

        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result)
            } else {
                res.status(403).send({ message: 'forbidden' })
            }

        })

        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = productsCollection.find(query);
            const products = await cursor.toArray();
            res.send(products)
        });
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const product = await productsCollection.findOne(query);
            res.send(product);
        })

        app.post('/order', verifyJWT, async (req, res) => {
            const order = req.body;
            const email = req.body.userEmail;
            const decodedEmail = req.decoded.email
            if (email === decodedEmail) {
                const result = await orderCollection.insertOne(order);
                res.send(result);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' })
            }
        })

        app.get('/order', verifyJWT, async (req, res) => {
            const email = req.query.userEmail;
            const decodedEmail = req.decoded.email
            if (email === decodedEmail) {
                const query = { userEmail: email };
                const cursor = orderCollection.find(query);
                const products = await cursor.toArray();
                return res.send(products)
            }
            else {
                return res.status(403).send({ message: 'forbidden access' })
            }
        })

        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });

        app.post('/addreview', async (req, res) => {
            const order = req.body;
            const result = await reviewCollection.insertOne(order);
            res.send(result);
        })

        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query);
            const products = await cursor.toArray();
            res.send(products)
        })
    }
    finally {

    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Computer Parts Running')
})

app.listen(port, () => {
    console.log(`Listening to port ${port}`);
})