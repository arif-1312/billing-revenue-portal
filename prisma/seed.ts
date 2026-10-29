import "@/lib/load-env"
import { assertAppEnv, assertProductionSeedPassword } from "@/lib/environment"
import { hashPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"
import { Status } from "@prisma/client"

async function main() {
    console.log("Seeding database...")

    const modules = [
        { name: "Dashboard", route: "/admin/dashboard" },
        { name: "P&L", route: "/admin/pl" },
        { name: "Contract Type", route: "/admin/contract-type" },
        { name: "Service Type", route: "/admin/service-type" },
        { name: "Billing Plan", route: "/admin/billing-plan" },
        { name: "Contract Duration", route: "/admin/contract-duration" },
        { name: "Customer", route: "/admin/customer" },
        { name: "Vendor", route: "/admin/vendor" },
        { name: "Company", route: "/admin/company" },
        { name: "Users", route: "/admin/users" },
        { name: "Roles", route: "/admin/roles" },
        { name: "Module", route: "/admin/module" },
        { name: "MonthPLs", route: "/admin/monthly-pl" },
        { name: "Revenue", route: "/admin/revenue" },
        { name: "Credit Note", route: "/admin/credit-note" },
        { name: "Configuration", route: "/admin/configuration" },
        { name: "Activity Log", route: "/admin/activity-log" },
        { name: "Notifications", route: "/admin/notifications" },
        { name: "Email", route: "/admin/email" },
    ];

    const createdModules = [];

    for (const mod of modules) {
        const description =
            mod.route === "/admin/email"
                ? "Email delivery settings and logs"
                : mod.name
        const m = await prisma.module.upsert({
            where: { route: mod.route },
            update:
                mod.route === "/admin/email"
                    ? { name: mod.name, description, status: Status.ACTIVE }
                    : {},
            create: {
                name: mod.name,
                route: mod.route,
                description,
            },
        });

        createdModules.push(m);
    }

    console.log("Modules seeded");

    const appEnv = assertAppEnv();
    const isProduction = appEnv === "production";
    const username = process.env.SEED_ADMIN_USERNAME?.trim() || "";
    const plainPassword = assertProductionSeedPassword(
        process.env.SEED_ADMIN_PASSWORD,
        appEnv,
    );
    const email = process.env.SEED_ADMIN_EMAIL?.trim() || "";

    if (!username || !email) {
        throw new Error(
            "Set SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD, and SEED_ADMIN_EMAIL before seeding this instance.",
        );
    }

    const password = await hashPassword(plainPassword);

    const adminRole = await prisma.role.upsert({
        where: { name: "Admin" },
        update: { isSystem: true },
        create: {
            name: "Admin",
            remark: "System Administrator",
            status: Status.ACTIVE,
            isSystem: true,
        }
    })

    for (const createdModule of createdModules) {
        const emailAccess = createdModule.route === "/admin/email"
        await prisma.roleModule.upsert({
            where: {
                roleId_moduleId: {
                    roleId: adminRole.id,
                    moduleId: createdModule.id,
                },
            },
            update: emailAccess
                ? {
                    canView: true,
                    canCreate: true,
                    canEdit: true,
                    canDelete: true,
                }
                : {},
            create: {
                roleId: adminRole.id,
                moduleId: createdModule.id,
                canView: true,
                canCreate: true,
                canEdit: true,
                canDelete: true,
            },
        });
    }

    await prisma.user.upsert({
        where: { email },
        update: {
            username,
            password,
            firstName: "Admin",
            lastName: isProduction ? "Production" : "Admin",
            status: Status.ACTIVE,
            roleId: adminRole.id,
        },
        create: {
            username,
            password,
            firstName: "Admin",
            lastName: isProduction ? "Production" : "Admin",
            email,
            status: Status.ACTIVE,
            roleId: adminRole.id,
        }
    })

    console.log(
        `Seeded ${isProduction ? "production" : "development"} admin username: ${username}`,
    );

    const customers = [
        {
            email: "customer1@technosyslabs.com",
            data: {
                customerCode: "CUSTOMER0001",
                phone: "9876543210",
                firstName: "Rahul",
                lastName: "Sharma",
                companyName: "Technosyslabs",
                alternatePhone: "9123456780",
                addressLine1: "Indirapuram",
                addressLine2: "Ghaziabad",
                city: "Ghaziabad",
                state: "UP",
                country: "India",
                postalCode: "201102",
                gstNumber: "07ABCDE1234F1Z5",
                panNumber: "ABCDE1234F",
                website: "http://technosyslabs.com",
                remark: "Regular client",
                status: Status.ACTIVE
            }
        },
        {
            email: "customer2@abc.com",
            data: {
                customerCode: "CUSTOMER0002",
                phone: "9812345678",
                firstName: "Amit",
                lastName: "Verma",
                companyName: "ABC Pvt Ltd",
                alternatePhone: "9898989898",
                addressLine1: "Sector 62",
                addressLine2: "Noida",
                city: "Noida",
                state: "UP",
                country: "India",
                postalCode: "201301",
                gstNumber: "09ABCDE5678G1Z2",
                panNumber: "ABCDE5678G",
                website: "http://abc.com",
                remark: "Corporate client",
                status: Status.ACTIVE
            }
        },
        {
            email: "customer3@xyz.com",
            data: {
                customerCode: "CUSTOMER0003",
                phone: "9000000000",
                firstName: "Neha",
                lastName: "Gupta",
                companyName: "XYZ Solutions",
                alternatePhone: "9111111111",
                addressLine1: "MG Road",
                addressLine2: "Gurgaon",
                city: "Gurgaon",
                state: "Haryana",
                country: "India",
                postalCode: "122001",
                gstNumber: "06ABCDE9999H1Z3",
                panNumber: "ABCDE9999H",
                website: "http://xyz.com",
                remark: "High priority client",
                status: Status.ACTIVE
            }
        },
        {
            email: "customer4@test.com",
            data: {
                customerCode: "CUSTOMER0004",
                phone: "8888888888",
                firstName: "Suresh",
                lastName: "Kumar",
                companyName: "Test Corp",
                alternatePhone: "8777777777",
                addressLine1: "Karol Bagh",
                addressLine2: "Delhi",
                city: "Delhi",
                state: "Delhi",
                country: "India",
                postalCode: "110005",
                gstNumber: "07TEST1234T1Z1",
                panNumber: "TEST1234T",
                website: "http://testcorp.com",
                remark: "Test customer",
                status: Status.INACTIVE
            }
        }
    ];

    for (const customer of customers) {
        await prisma.customer.upsert({
            where: { email: customer.email },
            update: {},
            create: customer.data
        });
    }

    const contractTypes = [
        { name: "Fixed Price", remark: "Pre-defined cost" },
        { name: "Time & Material", remark: "Based on time and material" },
        { name: "Cost Plus", remark: "Cost + margin" },
        { name: "AMC", remark: "Annual maintenance contract" },
        { name: "FMS", remark: "Facility management services" },
        { name: "Retainer", remark: "Recurring fixed payment" },
        { name: "Milestone-Based", remark: "Based on milestones" },
        { name: "Dedicated Resource", remark: "Dedicated team billing" },
        { name: "Hybrid", remark: "Combination model" },
        { name: "Other", remark: "Custom contract type" }
    ];

    await prisma.contractType.createMany({
        data: contractTypes,
        skipDuplicates: true
    });

    const serviceTypes = [
        { name: "FMS", remark: "Facility Management Services" },
        { name: "AMC", remark: "Annual Maintenance Contract" },
        { name: "Software", remark: "Software development and support" },
        { name: "Implementation", remark: "System implementation" },
        { name: "Consulting", remark: "IT consulting services" },
        { name: "Support", remark: "Technical support" },
        { name: "Upgrade", remark: "System upgrades" },
        { name: "Integration", remark: "System integration" },
        { name: "Training", remark: "User training" },
        { name: "Other", remark: "Misc services" }
    ];

    await prisma.serviceType.createMany({
        data: serviceTypes,
        skipDuplicates: true
    });

    const contractDurations = [
        { name: "3 Months", totalNumberOfMonths: 3, remark: "Short-term contract" },
        { name: "6 Months", totalNumberOfMonths: 6, remark: "Half-year contract" },
        { name: "9 Months", totalNumberOfMonths: 9, remark: "Quarter-year contract" },
        { name: "12 Months", totalNumberOfMonths: 12, remark: "One-year contract" },
        { name: "18 Months", totalNumberOfMonths: 18, remark: "1.5-year contract" },
        { name: "24 Months", totalNumberOfMonths: 24, remark: "Two-year contract" },
        { name: "36 Months", totalNumberOfMonths: 36, remark: "Three-year contract" },
        { name: "Custom", totalNumberOfMonths: 0, remark: "Custom duration" }
    ];

    await prisma.contractDuration.createMany({
        data: contractDurations,
        skipDuplicates: true
    });

    const billingPlans = [
        { name: "Monthly", totalBillingCycles: 12, remark: "Billing done every month" },
        { name: "Quarterly", totalBillingCycles: 4, remark: "Billing every 3 months" },
        { name: "Half-Yearly", totalBillingCycles: 2, remark: "Billing every 6 months" },
        { name: "Yearly", totalBillingCycles: 1, remark: "Single billing per year" },
        { name: "One-Time", totalBillingCycles: 1, remark: "One-time payment" },
        { name: "Milestone-Based", totalBillingCycles: 0, remark: "Based on milestones" },
        { name: "Custom", totalBillingCycles: 0, remark: "Flexible billing plan" }
    ];

    await prisma.billingPlan.createMany({
        data: billingPlans,
        skipDuplicates: true
    });

    const companies = [
        {
            name: "TechNova Solutions",
            companyCode: "TN001",
            email: "contact@technova.com",
            phone: "+91-9876543210",
            alternatePhone: "+91-9123456780",
            addressLine1: "123 Innovation Drive",
            addressLine2: "5th Floor, Block B",
            city: "Bangalore",
            state: "Karnataka",
            country: "India",
            pincode: "560001",
            gstNumber: "29ABCDE1234F1Z5",
            panNumber: "ABCDE1234F",
            cinNumber: "U12345KA2023PTC123456",
        },
        {
            name: "BluePeak Industries",
            companyCode: "BP002",
            email: "info@bluepeak.com",
            phone: "+91-9988776655",
            alternatePhone: "+91-9988776656",
            addressLine1: "45 Industrial Area",
            addressLine2: "Unit 7",
            city: "Pune",
            state: "Maharashtra",
            country: "India",
            pincode: "411001",
            gstNumber: "27ABCDE1234F2Z6",
            panNumber: "ABCDE1234G",
            cinNumber: "U54321MH2022PTC654321",
        },
        {
            name: "GreenLeaf Tech",
            companyCode: "GL003",
            email: "support@greenleaftech.com",
            phone: "+91-9123456789",
            alternatePhone: "+91-9876543211",
            addressLine1: "88 Green Park",
            addressLine2: "Suite 101",
            city: "Hyderabad",
            state: "Telangana",
            country: "India",
            pincode: "500081",
            gstNumber: "36ABCDE1234F3Z7",
            panNumber: "ABCDE1234H",
            cinNumber: "U67890TG2021PTC789012",
        },
    ];

    await prisma.company.createMany({
        data: companies,
        skipDuplicates: true
    });

    console.log("Seed completed")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
