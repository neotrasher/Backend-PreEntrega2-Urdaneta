import 'dotenv/config'
import mongoose from 'mongoose';
import express from 'express';
import { engine } from 'express-handlebars';
import http from 'http';
import { Server } from 'socket.io';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import productModel from './models/products.models.js';
import messageModel from './models/messages.models.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 8080;

mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'Error de conexión a MongoDB:'));
db.once('open', () => {
    console.log('Conexión exitosa a MongoDB.');
});

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));

app.use(express.json());

app.use('/api/products', productRoutes);
app.use('/api/carts', cartRoutes);

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/realtimeproducts', (req, res) => {
    res.render('realtimeproducts');
});

app.post('/api/messages', async (req, res) => {
    try {
        const { email, message } = req.body;
        const newMessage = new messageModel({ email, message });
        await newMessage.save();
        res.json(newMessage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/messages', async (req, res) => {
    try {
        const messages = await messageModel.find();
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/messages/:messageId', async (req, res) => {
    try {
        const messageId = req.params.messageId;
        const deletedMessage = await messageModel.findByIdAndDelete(messageId);

        if (!deletedMessage) {
            return res.status(404).json({ error: 'Mensaje no encontrado' });
        }

        res.status(200).send("Mensaje eliminado correctamente.");
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const server = http.createServer(app);
const io = new Server(server, {
    path: '/socket.io'
});

io.on('connection', (socket) => {
    console.log('Cliente conectado');

    socket.on('createProduct', async (productData) => {
        try {
            const newProduct = await productModel.create(productData);
            io.emit('productCreated', newProduct);
        } catch (error) {
            console.error("Error al crear el producto:", error);
        }
    });

    socket.on('deleteProduct', async (productId) => {
        try {
            await productModel.findByIdAndDelete(productId);
            io.emit('productDeleted', productId);
        } catch (error) {
            console.error("Error al eliminar el producto:", error);
        }
    });

    socket.on('updateProduct', async (updatedProductData) => {
        try {
            const { productId, updatedFields } = updatedProductData;
            const updatedProduct = await productModel.findByIdAndUpdate(
                productId,
                updatedFields,
                { new: true }
            );
            io.emit('productUpdated', updatedProduct);
        } catch (error) {
            console.error("Error al actualizar el producto:", error);
        }
    });
});

server.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});

export { io };
