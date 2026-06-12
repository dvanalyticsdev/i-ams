import { DEFAULT_DEPARTMENTS, PAYMENT_MODES } from './categories';
import { DEFAULT_EXPENSE_CATEGORIES } from './categoryDefaults';

// Helper to generate a random date in a range
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Department to employee mapping
const DEPT_EMPLOYEES = {
  "Engineering": ["Alice Smith", "Bob Johnson", "Charlie Brown", "Diana Prince", "David Miller"],
  "Marketing": ["Emma Watson", "Frank Miller", "Grace Hopper", "Henry Cavill", "Sarah Jenkins"],
  "Sales": ["Ivy Carter", "Jack Ryan", "Karen Page", "Leo Messi", "James Wilson"],
  "HR": ["Mona Lisa", "Ned Stark", "Olivia Pope", "Sophia Loren"],
  "Finance": ["Peter Parker", "Quill Cooper", "Rachel Green", "Walter White"],
  "Operations": ["Sam Wilson", "Tony Stark", "Bruce Banner", "John Doe"],
  "Legal": ["Matt Murdock", "Jessica Jones", "Harvey Specter"],
  "Customer Support": ["Steve Rogers", "Clark Kent", "Bruce Wayne", "Barry Allen"]
};

// Vendor list based on categories
const VENDORS_BY_SUBCATEGORY = {
  "Advertisement Expenses": ["Google Ads Inc.", "Meta Platforms Inc.", "LinkedIn Ads Services", "Local Media Agency"],
  "LMS Charges": ["LMS Portal Solutions", "Coursera Enterprise", "TalentLMS"],
  "Sponsorship Fees - Navodaya": ["Navodaya Trust"],
  "Sponsorship Fees - Karnataka Adarsh Odia Association": ["Karnataka Adarsh Odia Assoc"],
  "Sponsorship Fees - Odia Seva Samithi": ["Odia Seva Samithi Trust"],
  "Sponsorship Fees - Odia Youth Committee": ["Odia Youth Committee Board"],
  "Sponsorship Fees - Psaowadurgapuja": ["Psaowadurgapuja Committee"],
  "Sponsorship Fees - Utkal Youth": ["Utkal Youth Foundation"],
  "Marketing Expenses - Google Ads": ["Google Ads Inc."],
  "Marketing Expenses - Facebook Ads": ["Meta Ads Manager"],
  "Marketing Expenses - LinkedIn Ads": ["LinkedIn Campaign Manager"],
  "Marketing Expenses - Lead Squared CRM": ["LeadSquared CRM Inc."],
  "Marketing Expenses - Digital Ocean": ["Digital Ocean Cloud Services"],
  "Marketing Expenses - AI Dialer": ["AI Dialer Systems Ltd."],
  "Marketing Expenses - Servetel Communications": ["Servetel Communications Pvt Ltd"],
  "Marketing Expenses - Siteground Hosting": ["SiteGround Hosting Ltd."],
  "Marketing Expenses - VMC Technologies": ["VMC Technologies Pvt Ltd"],
  "Marketing Expenses - WhatsApp API": ["Meta WhatsApp Business API"],
  "Marketing Expenses - Zoom Video": ["Zoom Video Communications Inc."],
  "Marketing Expenses - Naukri Portal": ["Info Edge India Ltd. (Naukri)"],
  "Marketing Expenses - Metaverse Expo": ["Metaverse Expo Pvt Ltd"],
  "Marketing Expenses - Nextgen Technology": ["NextGen Tech Solutions"],
  "Marketing Expenses - Pamphlet Distribution": ["Express Pamphlet Distributors"],
  "Faculty Fees - Ayushkant": ["Ayushkant Panda (Consultant)"],
  "Faculty Fees - Debendra Debadutta Das": ["Debendra Das (Consultant)"],
  "Faculty Fees - Ganesh Rath": ["Ganesh Rath (Consultant)"],
  "Faculty Fees - Kuldeep Shahi": ["Kuldeep Shahi (Consultant)"],
  "Faculty Fees - Mradul Jain": ["Mradul Jain (Consultant)"],
  "Faculty Fees - Prabin Mohanty": ["Prabin Mohanty (Consultant)"],
  "Faculty Fees - Raj Narayan Birje": ["Raj Narayan Birje (Consultant)"],
  "Faculty Fees - Suresh Reddy": ["Suresh Reddy (Consultant)"],
  "Faculty Fees - Venkat Reddy Ko": ["Venkat Reddy Ko (Consultant)"],
  "Office Rent": ["DLF Commercial Properties", "Prestige Tech Park Rentals", "City Center Commercials"],
  "Office Expenses": ["Amazon Business", "Walmart Staples", "Local Grocery & Supplies"],
  "Office Maintenance": ["CleanSpace Cleaning Services", "TechPro HVAC Services", "Local Pest Control Solutions"],
  "Annual Function Expenses": ["Epic Events & Decorators", "Star Catering Services", "Grand Hyatt Banquet"],
  "Business Promotion Expenses": ["Vistaprint Branding", "Custom Merchandise Corp", "PromoGift Co."],
  "Consultancy Charges": ["Deloitte Advisory Services", "KPMG Audit & Tax", "LegalEagle Consultants"],
  "Courier Expenses": ["DHL Express", "FedEx Services", "Blue Dart Courier"],
  "Electricity Charges": ["State Power Corporation", "Grid Utility Services"],
  "Fuel Expenses": ["Shell Station", "Chevron Fuel Corp", "BP Fuel Services"],
  "Internet Expenses": ["Comcast Business", "Airtel Enterprise Broadband", "Verizon Fios"],
  "IT Expenses": ["Apple Store for Business", "Dell Commercial Services", "Lenovo IT Solutions"],
  "Local Conveyance Expense": ["Uber for Business", "Lyft Corporate Rides", "Local Yellow Cab Corp"],
  "Miscellaneous Expenses": ["Local Convenience Store", "Misc Cash Expenses"],
  "Printing & Stationery": ["Staples Corporate", "Office Depot Supplies", "Local Print Shop"],
  "Repairs and Maintenance": ["TechRepair Handyman", "PlumbPRO Solutions", "Local Electricians"],
  "Telephone & Communication Expenses": ["AT&T Business Mobile", "Verizon Business Wireless", "Airtel Telecommunications"],
  "Travelling Expenses": ["MakeMyTrip Business", "Corporate Travel Planners", "Expedia Business"],
  "Web Hosting Charges": ["AWS Cloud Services", "Google Cloud Platform", "Hostinger Enterprise"],
  "Bank Charges": ["Chase Business Banking", "ICICI Corporate Bank", "HSBC Business Bank"],
  "Interest on Loan": ["ICICI Bank Loans", "HDFC Corporate Loan Dept"],
  "Interest on OD": ["Chase Business OD Account"],
  "Interest on TDS": ["Income Tax Department"],
  "Processing Fees": ["Chase Business Banking", "ICICI Corporate Bank"],
  "Renewal Fees": ["Domain Registry LLC", "Software Licenses Inc."],
  "ROC filing fees": ["Ministry of Corporate Affairs"],
  "Penalty on PF": ["Employee Provident Fund Organisation"],
  "Salary expenses": ["Corporate Payroll Distribution"],
  "EPF Employer Contribution": ["Employee Provident Fund Organisation"],
  "Employees Group Insurance": ["Cigna Corporate Healthcare", "LIC Group Term Insurance"],
  "Incentive/Bonus": ["Corporate Incentive Pool"],
  "Referral Bonus": ["Staff Referral Program"],
  "Staff Welfare": ["Starbucks Office Catering", "Fresh Fruits Delivery", "Team Lunch Organizers"],
  "Other Deduction": ["Internal Payroll Adjustments"],
  "Equipment Depreciation": ["Asset Valuation Corp"],
  "Software Amortization": ["Asset Valuation Corp"],
  "Round Off": ["Accounting Adjustments"]
};

export const generateMockExpenses = () => {
  const list = [];
  const start = new Date(2026, 0, 1); // Jan 1 2026
  const end = new Date(2026, 5, 11);  // June 11 2026
  
  // 1. Generate core monthly repeating items (Rent, Salaries, EPF, Web Hosting)
  for (let month = 0; month <= 5; month++) {
    const year = 2026;
    if (month === 5 && end.getDate() < 5) continue;
    const monthlyDate = (day) => new Date(year, month, day);

    // Office Rent
    list.push({
      expenseId: `EXP-${year}-M${(month + 1).toString().padStart(2, '0')}-01`,
      date: monthlyDate(1).toISOString().split('T')[0],
      category: "Administration Expenses",
      subCategory: "Office Rent",
      amount: 125000 + Math.random() * 5000,
      paymentMode: "Net Banking",
      vendorName: "Prestige Tech Park Rentals",
      department: "Operations",
      employeeName: "Tony Stark",
      description: "Monthly commercial office space rent payment",
      attachment: "receipt_rent.pdf"
    });

    // Salary expenses
    list.push({
      expenseId: `EXP-${year}-M${(month + 1).toString().padStart(2, '0')}-02`,
      date: monthlyDate(1).toISOString().split('T')[0],
      category: "Human Resources Expenses",
      subCategory: "Salary expenses",
      amount: 450000 + Math.random() * 20000,
      paymentMode: "Net Banking",
      vendorName: "Corporate Payroll Distribution",
      department: "HR",
      employeeName: "Ned Stark",
      description: "Monthly company-wide employee payroll processing",
      attachment: "payroll_register.pdf"
    });

    // EPF Employer Contribution
    list.push({
      expenseId: `EXP-${year}-M${(month + 1).toString().padStart(2, '0')}-03`,
      date: monthlyDate(5).toISOString().split('T')[0],
      category: "Human Resources Expenses",
      subCategory: "EPF Employer Contribution",
      amount: 54000 + Math.random() * 2000,
      paymentMode: "Net Banking",
      vendorName: "Employee Provident Fund Organisation",
      department: "HR",
      employeeName: "Ned Stark",
      description: "Monthly employer EPF contribution deposit",
      attachment: "epf_challan.pdf"
    });

    // Web Hosting Charges
    list.push({
      expenseId: `EXP-${year}-M${(month + 1).toString().padStart(2, '0')}-04`,
      date: monthlyDate(2).toISOString().split('T')[0],
      category: "Administration Expenses",
      subCategory: "Web Hosting Charges",
      amount: 18000 + Math.random() * 1000,
      paymentMode: "Card",
      vendorName: "AWS Cloud Services",
      department: "Engineering",
      employeeName: "Alice Smith",
      description: "Production database & server instances cloud billing",
      attachment: "aws_invoice.pdf"
    });
  }

  // 2. Generate random variable transactions (~100 items)
  const categoriesList = Object.keys(DEFAULT_EXPENSE_CATEGORIES);
  
  for (let i = 1; i <= 100; i++) {
    const txDate = randomDate(start, end);
    const category = categoriesList[Math.floor(Math.random() * categoriesList.length)];
    const subCategories = DEFAULT_EXPENSE_CATEGORIES[category];
    const subCategory = subCategories[Math.floor(Math.random() * subCategories.length)];
    
    const department = DEFAULT_DEPARTMENTS[Math.floor(Math.random() * DEFAULT_DEPARTMENTS.length)];
    const employees = DEPT_EMPLOYEES[department];
    const employeeName = employees[Math.floor(Math.random() * employees.length)];
    const paymentMode = PAYMENT_MODES[Math.floor(Math.random() * PAYMENT_MODES.length)];
    const vendors = VENDORS_BY_SUBCATEGORY[subCategory] || ["General Marketplace"];
    const vendorName = vendors[Math.floor(Math.random() * vendors.length)];
    
    // Calculate realistic amounts
    let amount = 500 + Math.random() * 5000;
    if (category === "Operation Expenses") {
      if (subCategory.includes("Marketing Expenses")) {
        amount = 15000 + Math.random() * 35000;
      } else if (subCategory.includes("Faculty Fees")) {
        amount = 8000 + Math.random() * 12000;
      } else if (subCategory.includes("LMS Charges")) {
        amount = 25000 + Math.random() * 15000;
      } else if (subCategory.includes("Sponsorship Fees")) {
        amount = 10000 + Math.random() * 20000;
      }
    } else if (category === "Administration Expenses") {
      if (subCategory === "Travelling Expenses") {
        amount = 6000 + Math.random() * 20000;
      } else if (subCategory === "IT Expenses") {
        amount = 12000 + Math.random() * 45000;
      } else if (subCategory === "Electricity Charges") {
        amount = 8000 + Math.random() * 6000;
      } else if (subCategory === "Office Rent") {
        amount = 125000;
      } else if (subCategory === "Round Off") {
        amount = Math.random() * 10 - 5;
      }
    } else if (category === "Financial Expenses") {
      if (subCategory.includes("Interest")) {
        amount = 4000 + Math.random() * 15000;
      } else {
        amount = 150 + Math.random() * 1200;
      }
    } else if (category === "Human Resources Expenses") {
      if (subCategory === "Incentive/Bonus") {
        amount = 15000 + Math.random() * 25000;
      } else if (subCategory === "Staff Welfare") {
        amount = 1200 + Math.random() * 4000;
      }
    } else if (category === "Depreciation & Amortization") {
      amount = 5000 + Math.random() * 2000;
    }
    
    amount = Math.round(amount * 100) / 100;
    
    // Description builder
    let description = `Expense reimbursement for ${subCategory.toLowerCase()}`;
    if (subCategory.includes("Marketing")) {
      description = `Quarterly advertisement billing for target audience campaigns`;
    } else if (subCategory.includes("Faculty")) {
      description = `Honorarium payment for training workshop facilitation`;
    } else if (subCategory === "Travelling Expenses") {
      description = `Flight ticket and hotel accommodation booking for client meeting`;
    } else if (subCategory === "Fuel Expenses") {
      description = `Fuel replenishment for corporate pool vehicle`;
    } else if (subCategory === "Office Expenses") {
      description = `Purchase of office pantry refreshments and coffee beans`;
    } else if (subCategory === "Printing & Stationery") {
      description = `Bulk copy paper and cartridge print toner supplies`;
    } else if (subCategory === "IT Expenses") {
      description = `Purchase of new development monitor and workspace accessories`;
    } else if (subCategory === "Internet Expenses") {
      description = `Monthly high-speed office fiber broadband internet connection fee`;
    } else if (subCategory === "Staff Welfare") {
      description = `Refreshments and catering for team monthly achievements celebrate`;
    } else if (subCategory === "Sponsorship Fees") {
      description = `Corporate banner branding sponsorship at community festival`;
    }
    
    const formattedDate = txDate.toISOString().split('T')[0];
    const txIdIdx = i.toString().padStart(4, '0');
    
    list.push({
      expenseId: `EXP-${txDate.getFullYear()}-${txIdIdx}`,
      date: formattedDate,
      category,
      subCategory,
      amount,
      paymentMode,
      vendorName,
      department,
      employeeName,
      description,
      attachment: Math.random() > 0.4 ? `receipt_tx_${i}.jpg` : null
    });
  }
  
  return list.sort((a, b) => new Date(b.date) - new Date(a.date));
};
