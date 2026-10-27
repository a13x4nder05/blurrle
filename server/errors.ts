export class DailyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
