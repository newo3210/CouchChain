import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Deploy RoutePassport
  const RoutePassport = await ethers.getContractFactory("RoutePassport");
  const routePassport = await RoutePassport.deploy(deployer.address);
  await routePassport.waitForDeployment();
  const rpAddress = await routePassport.getAddress();
  console.log("RoutePassport deployed to:", rpAddress);

  // Deploy TrustRegistry (references RoutePassport for anti-sybil)
  const TrustRegistry = await ethers.getContractFactory("TrustRegistry");
  const trustRegistry = await TrustRegistry.deploy(rpAddress);
  await trustRegistry.waitForDeployment();
  const trAddress = await trustRegistry.getAddress();
  console.log("TrustRegistry deployed to:", trAddress);

  console.log("\nAdd to .env.local:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${rpAddress}`);
  console.log(`NEXT_PUBLIC_TRUST_REGISTRY_ADDRESS=${trAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
