const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const app = express();
const PORT = 8080;

const cache = new NodeCache({ stdTTL: 3600 });

const API_URL = 'http://20.244.56.144/test';
const COMPANIES = ["AMZ", "FLP", "SNP", "MYN", "AZO"];
const MAX_PRODUCTS_PER_PAGE = 10;

const fetchProducts = async (company, category, minPrice, maxPrice) => {
    const cacheKey = `${company}-${category}-${minPrice}-${maxPrice}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const url = `${API_URL}/companies/${company}/categories/${category}/products/topminPrice-${minPrice}&maxPrice-${maxPrice}`;
    const response = await axios.get(url);
    const products = response.data;
    cache.set(cacheKey, products);
    return products;
};


const generateUniqueId = (product, index) => {
    return `${product.productName}-${index}`;
};


app.get('/categories/:category/products', async (req, res) => {
    const { category } = req.params;
    const { n, page = 1, sort, order = 'asc', minPrice = 0, maxPrice = Infinity } = req.query;

    if (!n || n > 10) {
        return res.status(400).send('Query parameter "n" must be specified and cannot exceed 10.');
    }

    try {
        const allProducts = [];

        for (const company of COMPANIES) {
            const products = await fetchProducts(company, category, minPrice, maxPrice);
            allProducts.push(...products.map((product, index) => ({
                ...product,
                id: generateUniqueId(product, index),
                company
            })));
        }

    
        if (sort) {
            allProducts.sort((a, b) => {
                if (order === 'asc') {
                    return a[sort] > b[sort] ? 1 : -1;
                } else {
                    return a[sort] < b[sort] ? 1 : -1;
                }
            });
        }

        const startIndex = (page - 1) * n;
        const endIndex = page * n;
        const paginatedProducts = allProducts.slice(startIndex, endIndex);

        res.json(paginatedProducts);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/categories/:category/products/:productId', async (req, res) => {
    const { category, productId } = req.params;

    try {
        for (const company of COMPANIES) {
            const products = await fetchProducts(company, category, 0, Infinity);
            const product = products.find(p => generateUniqueId(p, products.indexOf(p)) === productId);

            if (product) {
                return res.json(product);
            }
        }

        res.status(404).send('Product not found');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});