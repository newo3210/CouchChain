import { expect } from "chai";
import { ethers } from "hardhat";

describe("RoutePassport", () => {
  it("should mint a route and return tokenId 1", async () => {
    const [owner] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("RoutePassport");
    const rp = await factory.deploy(owner.address);
    await rp.waitForDeployment();

    const tx = await rp.createRoute("QmTestHash");
    const receipt = await tx.wait();
    expect(receipt?.status).to.equal(1);
    expect(await rp.totalRoutes()).to.equal(1n);
    expect(await rp.hasMintedRoute(owner.address)).to.be.true;
  });

  it("should replicate a route with provenance", async () => {
    const [owner, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("RoutePassport");
    const rp = await factory.deploy(owner.address);
    await rp.waitForDeployment();

    await rp.createRoute("QmOriginal");
    await rp.connect(other).replicateRoute(1n, "QmReplica");

    expect(await rp.originalRouteId(2n)).to.equal(1n);
    expect(await rp.replicaCount(1n)).to.equal(1n);
  });
});

describe("TrustRegistry", () => {
  it("should issue a stamp and increment reputation", async () => {
    const [owner, host] = await ethers.getSigners();
    const RP = await ethers.getContractFactory("RoutePassport");
    const rp = await RP.deploy(owner.address);
    await rp.waitForDeployment();

    const TR = await ethers.getContractFactory("TrustRegistry");
    const tr = await TR.deploy(await rp.getAddress());
    await tr.waitForDeployment();

    // Must mint a route first (anti-sybil)
    await rp.createRoute("QmTest");

    await tr.issueStamp(host.address, 1n, "r3gd", "");
    expect(await tr.getReputation(host.address)).to.equal(1n);
  });

  it("should block stamp if no route minted", async () => {
    const [_owner, traveler, host] = await ethers.getSigners();
    const RP = await ethers.getContractFactory("RoutePassport");
    const rp = await RP.deploy(_owner.address);
    await rp.waitForDeployment();

    const TR = await ethers.getContractFactory("TrustRegistry");
    const tr = await TR.deploy(await rp.getAddress());
    await tr.waitForDeployment();

    // traveler has no route → should revert
    await expect(
      tr.connect(traveler).issueStamp(host.address, 0n, "r3gd", "")
    ).to.be.revertedWith("Anti-sybil: mint at least one route before issuing stamps");
  });
});
