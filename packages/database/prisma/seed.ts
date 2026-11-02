import bcrypt from "bcryptjs";
import { prisma, WorkspaceRole, FileType } from "../src";

export async function seed() {
  console.log("🌱 Starting database seeding...");

  const seedEmail = (process.env.SEED_USER_EMAIL || "developer@codesync.dev").toLowerCase().trim();
  const seedPassword = process.env.SEED_USER_PASSWORD || "DevelopmentPassword123!";
  const seedName = process.env.SEED_USER_NAME || "CodeSync Developer";

  // 1. Upsert Test User
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(seedPassword, salt);

  const user = await prisma.user.upsert({
    where: { email: seedEmail },
    update: {
      name: seedName,
      passwordHash,
    },
    create: {
      name: seedName,
      email: seedEmail,
      passwordHash,
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=codesync",
    },
  });

  console.log(`👤 Test user ready: ${user.email} (ID: ${user.id})`);

  // 2. Upsert Demo Workspace
  let workspace = await prisma.workspace.findFirst({
    where: {
      ownerId: user.id,
      name: "Demo Workspace",
    },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Demo Workspace",
        description: "Default collaborative development workspace",
        ownerId: user.id,
      },
    });
    console.log(`📁 Created demo workspace: ${workspace.name} (ID: ${workspace.id})`);
  } else {
    console.log(`📁 Demo workspace exists: ${workspace.name} (ID: ${workspace.id})`);
  }

  // 3. Upsert Owner Membership
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {
      role: WorkspaceRole.OWNER,
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
    },
  });

  console.log(`🔑 Owner membership verified for user in workspace.`);

  // 4. Upsert Sample Folders and Files (Idempotent)
  // Root README.md
  let readme = await prisma.file.findFirst({
    where: {
      workspaceId: workspace.id,
      parentId: null,
      name: "README.md",
    },
  });

  if (!readme) {
    readme = await prisma.file.create({
      data: {
        workspaceId: workspace.id,
        name: "README.md",
        type: FileType.FILE,
        parentId: null,
      },
    });
    console.log(`📄 Created root file: README.md`);
  }

  // Root 'src' folder
  let srcFolder = await prisma.file.findFirst({
    where: {
      workspaceId: workspace.id,
      parentId: null,
      name: "src",
      type: FileType.FOLDER,
    },
  });

  if (!srcFolder) {
    srcFolder = await prisma.file.create({
      data: {
        workspaceId: workspace.id,
        name: "src",
        type: FileType.FOLDER,
        parentId: null,
      },
    });
    console.log(`📂 Created root folder: src/`);
  }

  // 'src/index.ts' file
  const indexFile = await prisma.file.findFirst({
    where: {
      workspaceId: workspace.id,
      parentId: srcFolder.id,
      name: "index.ts",
    },
  });

  if (!indexFile) {
    await prisma.file.create({
      data: {
        workspaceId: workspace.id,
        name: "index.ts",
        type: FileType.FILE,
        parentId: srcFolder.id,
      },
    });
    console.log(`📄 Created file: src/index.ts`);
  }

  // 'src/components' folder
  let componentsFolder = await prisma.file.findFirst({
    where: {
      workspaceId: workspace.id,
      parentId: srcFolder.id,
      name: "components",
      type: FileType.FOLDER,
    },
  });

  if (!componentsFolder) {
    componentsFolder = await prisma.file.create({
      data: {
        workspaceId: workspace.id,
        name: "components",
        type: FileType.FOLDER,
        parentId: srcFolder.id,
      },
    });
    console.log(`📂 Created nested folder: src/components/`);
  }

  // 'src/components/App.tsx' file
  const appFile = await prisma.file.findFirst({
    where: {
      workspaceId: workspace.id,
      parentId: componentsFolder.id,
      name: "App.tsx",
    },
  });

  if (!appFile) {
    await prisma.file.create({
      data: {
        workspaceId: workspace.id,
        name: "App.tsx",
        type: FileType.FILE,
        parentId: componentsFolder.id,
      },
    });
    console.log(`📄 Created file: src/components/App.tsx`);
  }

  console.log("✅ Database seeding completed successfully!");
}

if (require.main === module) {
  seed()
    .catch((error) => {
      console.error("❌ Error while seeding database:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
