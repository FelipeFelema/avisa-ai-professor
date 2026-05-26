export type Classroom = {
  id: string;
  name: string;
  createdAt: string;
  userClassrooms: {
    id: string;
    user: {
      id: string;
      name: string;
    };
  }[];
};
