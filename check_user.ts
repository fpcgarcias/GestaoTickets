
import * as dotenv from "dotenv";
dotenv.config();
import { db } from "./server/db";
import { users, customers } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkUser() {
  try {
    console.log("Checking for felipe@dnagata.com.br...");
    
    const userList = await db.select().from(users).where(eq(users.email, "felipe@dnagata.com.br"));
    console.log("User record(s):", JSON.stringify(userList, null, 2));

    const customerList = await db.select().from(customers).where(eq(customers.email, "felipe@dnagata.com.br"));
    console.log("Customer record(s):", JSON.stringify(customerList, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkUser();
import { users, customers } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkUser() {
  try {
    console.log("Checking for felipe@dnagata.com.br...");
    
    const user = await db.select().from(users).where(eq(users.email, "felipe@dnagata.com.br"));
    console.log("User record:", user);

    const customer = await db.select().from(customers).where(eq(customers.email, "felipe@dnagata.com.br"));
    console.log("Customer record:", customer);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkUser();

