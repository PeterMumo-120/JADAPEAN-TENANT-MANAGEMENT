export type Tenant = { id: string; name: string; initials: string; unit: string; building: string; estate: string; phone: string; rent: number; balance: number; status: "Paid" | "Pending" | "Overdue"; receipt: string; paidOn: string }
export type Building = { name: string; estate: string; units: number; occupied: number; collected: number; target: number }
export const buildings: Building[] = [
  { name: "Kijani Court", estate: "Kilimani, Nairobi", units: 124, occupied: 118, collected: 2860000, target: 3180000 },
  { name: "Mawingu Heights", estate: "Westlands, Nairobi", units: 96, occupied: 91, collected: 2340000, target: 2500000 },
  { name: "Acacia Villas", estate: "Lavington, Nairobi", units: 68, occupied: 64, collected: 1920000, target: 2080000 },
  { name: "Riverside Flats", estate: "Ngara, Nairobi", units: 82, occupied: 76, collected: 1480000, target: 1740000 },
]
export const tenants: Tenant[] = [
  { id: "T-1042", name: "Wanjiku Mwangi", initials: "WM", unit: "B-204", building: "Kijani Court", estate: "Kilimani", phone: "0712 345 678", rent: 45000, balance: 0, status: "Paid", receipt: "TLN7K2M9QA", paidOn: "Today, 9:42 AM" },
  { id: "T-1088", name: "Brian Otieno", initials: "BO", unit: "A-108", building: "Mawingu Heights", estate: "Westlands", phone: "0722 481 903", rent: 38000, balance: 0, status: "Paid", receipt: "TLN6J1P4RB", paidOn: "Today, 8:16 AM" },
  { id: "T-0931", name: "Amina Hassan", initials: "AH", unit: "C-301", building: "Acacia Villas", estate: "Lavington", phone: "0703 567 214", rent: 52000, balance: 26000, status: "Pending", receipt: "—", paidOn: "Awaiting payment" },
  { id: "T-0872", name: "Peter Kamau", initials: "PK", unit: "D-012", building: "Riverside Flats", estate: "Ngara", phone: "0718 902 113", rent: 25000, balance: 50000, status: "Overdue", receipt: "—", paidOn: "3 months overdue" },
  { id: "T-1105", name: "Grace Njeri", initials: "GN", unit: "A-402", building: "Kijani Court", estate: "Kilimani", phone: "0791 224 807", rent: 42000, balance: 0, status: "Paid", receipt: "TLN5H8D2FC", paidOn: "Yesterday, 4:27 PM" },
  { id: "T-0776", name: "David Kiprotich", initials: "DK", unit: "B-105", building: "Mawingu Heights", estate: "Westlands", phone: "0725 331 690", rent: 35000, balance: 35000, status: "Overdue", receipt: "—", paidOn: "1 month overdue" },
  { id: "T-1039", name: "Faith Wambui", initials: "FW", unit: "C-207", building: "Acacia Villas", estate: "Lavington", phone: "0708 119 425", rent: 48000, balance: 0, status: "Paid", receipt: "TLN4F3M7LK", paidOn: "Yesterday, 11:03 AM" },
  { id: "T-0955", name: "Josephine Achieng", initials: "JA", unit: "D-308", building: "Riverside Flats", estate: "Ngara", phone: "0714 777 203", rent: 28000, balance: 14000, status: "Pending", receipt: "—", paidOn: "Partial · 14 Nov" },
]
export const payments = tenants.filter((tenant) => tenant.status === "Paid").map((tenant, index) => ({ ...tenant, amount: tenant.rent, time: ["9:42 AM", "8:16 AM", "Yesterday, 4:27 PM", "Yesterday, 11:03 AM"][index] }))
export const rentTrend = [
  { month: "Jun", value: 6.3 }, { month: "Jul", value: 7.2 }, { month: "Aug", value: 6.8 }, { month: "Sep", value: 8.1 }, { month: "Oct", value: 7.7 }, { month: "Nov", value: 8.6 },
]
export const collections = { collected: 8_600_000, target: 9_500_000, outstanding: 1_240_000, occupied: 349, units: 370, tenants: 1084 }