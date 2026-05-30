export interface QueueItem {
  id: string;
  orderType: 'walkin' | 'booking';
  nickname: string;
  phone: string;
  course: string;
  bookingDate: string;
  bookingTime: string;
  gender: string;
  waterTemp: string;
  oil: string;
  shampoo: string;
  massagePressure: string;
  headPressure: string;
  caution: string;
  status: 'Pending' | 'Waiting' | 'Serving' | 'Completed' | 'Cancelled' | 'Archived';
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  isPaid: boolean;
  isDepositPaid: boolean;
  actualPrice?: number;
  internalNote?: string;
  serviceStartTime?: string;
  notifiedNext?: boolean;
  lineUserId?: string;
  lineDisplayName?: string;
  linePictureUrl?: string;
  discount?: string;
}

export interface SystemSettings {
  id: 'SYS_SETTINGS';
  staffLineIds: string[];
}
