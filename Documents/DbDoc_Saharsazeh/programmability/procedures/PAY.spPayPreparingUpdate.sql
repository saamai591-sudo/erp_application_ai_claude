
-------------------------------------------------------------------------------------------------------------
CREATE       PROC [PAY].[spPayPreparingUpdate]
    @PayPreparingID INT,
    @BranchID INT,
    @CalendarMonthID INT,
    @PayrollPaymentTypeID INT,
    @OrganizationItemID INT = NULL,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
	@Number int,
	@BankBranchID int,
    @PayrollFileID int
AS
SET NOCOUNT ON;

IF @Version =
(
    SELECT [Version]
    FROM [PAY].[PayPreparing]
    WHERE [PayPreparingID] = @PayPreparingID
)
BEGIN

    SET @Version = @Version + 1;

    UPDATE [PAY].[PayPreparing]
    SET [BranchID] = @BranchID,
        [CalendarMonthID] = @CalendarMonthID,
        [PayrollPaymentTypeID] = @PayrollPaymentTypeID,
        [OrganizationItemID] = @OrganizationItemID,
        [Version] = @Version,
        [Creator] = @Creator,
        [CreationDate] = @CreationDate,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
		Number= @Number,
		BankBranchID = @BankBranchID,
        PayrollFileID = @PayrollFileID
    WHERE [PayPreparingID] = @PayPreparingID;

    -- Begin Return Select <- do not remove
    SELECT  [Version],
            Number
    FROM [PAY].[PayPreparing]
    WHERE [PayPreparingID] = @PayPreparingID;
-- End Return Select <- do not remove

END;
