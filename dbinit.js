require("dotenv").config();
const pg = require("pg");
const { Pool, Client } = pg;

const dbConfig = {
  development: {
    user: process.env.user,
    host: process.env.host,
    database: process.env.database,
    password: process.env.password,
    port: process.env.port,
  },
  production: {
    connectionString: process.env.POSTGRES_URL,
  },
};

const db = new Client(dbConfig[process.env.ENV]);

db.connect();

const createUsersTable = `
  CREATE TABLE IF NOT EXISTS Users (
    id SERIAL PRIMARY KEY,
    extend TEXT,
    firstname VARCHAR(50),
    lastname VARCHAR(50),
    email VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(256),
    question TEXT,
    answer TEXT,
    phone VARCHAR(20),
    userId VARCHAR(100),
    status VARCHAR(10),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;
db.query(createUsersTable).catch((err) => console.error(err));

const createItemsTable = `
    CREATE TABLE IF NOT EXISTS Items (
    id SERIAL PRIMARY KEY,
    itemId VARCHAR(50),
    ownerId VARCHAR(50), 
    title VARCHAR(50),
    description TEXT, 
    imageUrls TEXT,
    weight NUMERIC(5,2),
    height NUMERIC(5,2),
    width NUMERIC(5,2),
    length NUMERIC(5,2),
    postAt VARCHAR(20),
    expireAt VARCHAR(20),
    sending VARCHAR(10), 
    status VARCHAR(10),
    extend TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;
db.query(createItemsTable).catch((err) => console.error(err));

const createAddressesTable = `
    CREATE TABLE IF NOT EXISTS Addresses (
    id SERIAL PRIMARY KEY,
    userId VARCHAR(50),
    address TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;
db.query(createAddressesTable).catch((err) => console.error(err));

const createItemActionsTable = `
    CREATE TABLE IF NOT EXISTS ItemActions (
    id SERIAL PRIMARY KEY,
    itemId VARCHAR(50),
    ownerId VARCHAR(50),
    clickerId VARCHAR(50),
    act VARCHAR(50),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;
db.query(createItemActionsTable).catch((err) => console.error(err));

const createMatchesTable = `
    CREATE TABLE IF NOT EXISTS Matches (
    id SERIAL PRIMARY KEY,
    itemIdA VARCHAR(50),
    ownerIdA VARCHAR(50),
    itemIdB VARCHAR(50),
    ownerIdB VARCHAR(50),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;
db.query(createMatchesTable).catch((err) => console.error(err));

// const createResPostingsTable = `
//     CREATE TABLE IF NOT EXISTS ResPostings (
//     id SERIAL PRIMARY KEY,
//     itemId VARCHAR(50),
//     residue VARCHAR(20),
//     createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//   )
// `;
// db.query(createResPostingsTable).catch((err) => console.error(err));

module.exports = db;
