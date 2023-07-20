const axios = require('axios');
const jwt = require('jsonwebtoken');
const Sequelize = require('sequelize');
const { STRING, INTEGER } = Sequelize;
const config = { logging: false };

if (process.env.LOGGING) {
  delete config.logging;
}

const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/acme_db',
  config
);

const User = conn.define('user', { username: STRING, password: STRING });

User.byToken = async (token) => {
  try {
    const { id } = await jwt.verify(token, process.env.JWT);
    const user = await User.findByPk(id);
    if (user) {
      return user;
    }
    throw 'noooo';
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

// documentation - https://docs.github.com/en/developers/apps/authorizing-oauth-apps
// useful urls
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
//the authenticate methods is passed a code which has been sent by github
//if successful it will return a token which identifies a user in this app
User.authenticate = async (code) => {
  try {
    //consider modifying /github/callback route in app.js in order to test incrementally
    //(STEP 1) TODO - make axios post to GITHUB_TOKEN_URL with code, client_id, client_secret;
    /* * use { headers: { accept: 'application/json' }} for easier response handling */
    const { data } = await axios.post(
      GITHUB_TOKEN_URL,
      {
        code,
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        redirect_url: 'http://localhost:3000/github/callback',
      },
      { headers: { accept: 'application/json' } }
    );
    //(STEP 2) TODO - use access_token from response to make get request to GITHUB_USER_URL
    //send header with Authorization and value 'token whatever_access_token_is'
    /* headers: { Authorization: `token ${access_token}` } */
    const res = await axios.get(GITHUB_USER_URL, {
      headers: { Authorization: `token ${data.access_token}` },
    });
    //(STEP 3) TODO - use the login value from github to identify user in app
    //login from github should map to username in application
    //if the user does not exist, create the user
    //return a JWT token which has an id property with the users id
    const [user] = await User.findOrCreate({
      where: { username: res.data.login },
    });
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT || 'SuperSecretPWD'
    );
    if (token) {
      return token;
    }
    throw new Error('noooooooooo');
  } catch (error) {
    console.log(error);
  }
};

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw' },
    { username: 'moe', password: 'moe_pw' },
    { username: 'larry', password: 'larry_pw' },
  ];

  //creating the users
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );
};

module.exports = { syncAndSeed, models: { User } };
