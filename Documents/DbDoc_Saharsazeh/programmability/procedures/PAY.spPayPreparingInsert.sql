
-------------------------------------------------------------------------------------------------------------
CREATE     PROC [PAY].[spPayPreparingInsert]
    @BranchID INT,
    @CalendarMonthID INT,
    @PayrollPaymentTypeID INT,
    @OrganizationItemID INT = NULL,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
	@Number int,
	@BankBranchID int,
    @PayrollFileID int
AS
SET NOCOUNT ON;

if @Number is null or @Number = ''
select @Number = isnull(max(Number),0) + 1 from  [PAY].[PayPreparing]

INSERT INTO [PAY].[PayPreparing]
(
    [BranchID],
    [CalendarMonthID],
    [PayrollPaymentTypeID],
    [OrganizationItemID],
    [Version],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
	Number,
	BankBranchID,
    PayrollFileID
)
SELECT @BranchID,
       @CalendarMonthID,
       @PayrollPaymentTypeID,
       @OrganizationItemID,
       0,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate,
	   @Number,
	   @BankBranchID,
       @PayrollFileID

-- Begin Return Select <- do not remove
SELECT [PayPreparingID],
       [Version],
	   Number
FROM [PAY].[PayPreparing]
WHERE [PayPreparingID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
