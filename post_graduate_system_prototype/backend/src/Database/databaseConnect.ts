import moongose from "mongoose";

export async function ConnectToDataBase() {
  let mongooseConnectionString = process.env.DATABASE_CONNECTION_STRING;
  if (!mongooseConnectionString) {
    throw Error("Database connection string missing");
  }
  try {
    await moongose.connect(mongooseConnectionString);
    console.log("Database connection successful");
  } catch (error) {
    console.log(`This error happened ${error}`);
  }
}
