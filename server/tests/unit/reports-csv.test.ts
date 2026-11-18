import { describe, expect, it } from "vitest";

import { monthlyReportToCsv, type MonthlyReport } from "../../src/modules/reports/reports.service.ts";

function report(overrides: Partial<MonthlyReport> = {}): MonthlyReport {
  const base: MonthlyReport = {
    month: { id: "m1", year: 2026, month: 12, label: "2026-12", status: "OPEN", daysInMonth: 31 },
    meal: {
      totalMealCount: 93,
      mealExpensePoisha: "930000",
      mealExpenseTaka: "9300.00",
      mealRatePoisha: "10000",
      mealRateTaka: "100.00",
    },
    expenses: {
      totalApprovedPoisha: "4030000",
      totalApprovedTaka: "40300.00",
      approvedCount: 2,
      pendingCount: 1,
      rejectedCount: 0,
      byCategory: [
        { category: "MEAL_BAZAR", amountPoisha: "930000", amountTaka: "9300.00" },
        { category: "RENT", amountPoisha: "3100000", amountTaka: "31000.00" },
      ],
    },
    deposits: {
      verifiedTotalPoisha: "6000000",
      verifiedTotalTaka: "60000.00",
      pendingTotalPoisha: "200000",
      pendingTotalTaka: "2000.00",
      verifiedCount: 3,
      pendingCount: 1,
    },
    cash: {
      openingCashPoisha: "1000000",
      openingCashTaka: "10000.00",
      confirmedInflowsPoisha: "6000000",
      approvedPaymentsPoisha: "4030000",
      closingCashPoisha: "2970000",
      closingCashTaka: "29700.00",
    },
    budget: {
      budgetPoisha: "5000000",
      budgetTaka: "50000.00",
      spentPoisha: "4030000",
      remainingPoisha: "970000",
      remainingTaka: "9700.00",
      utilisationPercent: 80.6,
    },
    members: [
      {
        memberId: "u1",
        memberName: "Rahim, Md",
        role: "MANAGER",
        status: "ACTIVE",
        mealCount: 31,
        mealCostPoisha: "310000",
        mealCostTaka: "3100.00",
        verifiedDepositsPoisha: "2000000",
        verifiedDepositsTaka: "20000.00",
        allocatedChargesPoisha: "1033334",
        allocatedChargesTaka: "10333.34",
        creditsPoisha: "0",
        debitsPoisha: "0",
        adjustmentsPoisha: "0",
        balancePoisha: "566666",
        balanceTaka: "5666.66",
      },
    ],
    totals: {
      memberMealCostPoisha: "930000",
      memberAllocatedPoisha: "3100000",
      memberBalancePoisha: "1970000",
      outstandingPoisha: "0",
      advancePoisha: "1970000",
    },
    generatedAt: "2026-12-31T18:00:00.000Z",
  };
  return { ...base, ...overrides };
}

describe("monthlyReportToCsv", () => {
  it("starts with a UTF-8 BOM so Excel renders Bangla and ৳ correctly", () => {
    expect(monthlyReportToCsv(report()).startsWith("\uFEFF")).toBe(true);
  });

  it("uses CRLF line endings", () => {
    const csv = monthlyReportToCsv(report());
    expect(csv.includes("\r\n")).toBe(true);
    // No bare LF that is not preceded by CR.
    expect(/[^\r]\n/.test(csv)).toBe(false);
  });

  it("includes the headline figures", () => {
    const csv = monthlyReportToCsv(report());
    expect(csv).toContain("Monthly report — 2026-12");
    expect(csv).toContain("Meal rate (BDT/meal),100.00");
    expect(csv).toContain("Total meal count,93");
    expect(csv).toContain("MEAL_BAZAR,9300.00");
    expect(csv).toContain("RENT,31000.00");
    expect(csv).toContain("Closing cash (BDT),29700.00");
    expect(csv).toContain("Budget remaining (BDT),9700.00");
  });

  it("quotes and escapes cell values containing commas", () => {
    const csv = monthlyReportToCsv(report());
    expect(csv).toContain('"Rahim, Md"');
  });

  it("quotes and escapes double quotes inside a value", () => {
    const csv = monthlyReportToCsv(
      report({
        members: [
          {
            ...report().members[0]!,
            memberName: 'Md "Rahim"',
          },
        ],
      }),
    );
    expect(csv).toContain('"Md ""Rahim"""');
  });
});
