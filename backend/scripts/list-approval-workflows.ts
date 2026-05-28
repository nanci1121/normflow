import "dotenv/config";
import { prisma } from "../src/db";

async function main() {
  const workflows = await prisma.approvalWorkflow.findMany({
    include: {
      steps: {
        include: {
          approver: {
            select: { id: true, name: true, email: true, isActive: true },
          },
        },
        orderBy: { stepOrder: "asc" },
      },
    },
    orderBy: { category: "asc" },
  });

  if (workflows.length === 0) {
    console.log("No hay circuitos de aprobacion configurados.");
    return;
  }

  console.log(`Circuitos encontrados: ${workflows.length}`);

  for (const workflow of workflows) {
    console.log("\n----------------------------------------");
    console.log(`Categoria: ${workflow.category}`);
    console.log(`Workflow ID: ${workflow.id}`);
    console.log(`Pasos: ${workflow.steps.length}`);

    for (const step of workflow.steps) {
      const approver = step.approver;
      console.log(
        `  Paso ${step.stepOrder} | ${step.responsibility} | ${approver.name} <${approver.email}> | activo=${approver.isActive}`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error("Error listando circuitos:", (error as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
