
----------------------------------------------------------------------------------------------
CREATE    PROC [REQ].SpReceiveRequestInsert
    @FinancialPeriodID int,
    @Type tinyint,
    @Number int,
    @Date date,
    @BranchID int,
    @PartyID bigint,
    @CurrencyID int,
    @Amount decimal(36, 10),
    @Non_Received decimal(36, 10),
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @Status tinyint,
    @Creator int,
    @CreationDate datetime,
	@OrganizationUnitID INT,
	@ReviewDate DATETIME NULL,
    @Reviewer INT NULL
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 
	IF(@Number IS NOT NULL and @Number <> 0)
	Begin
		IF EXISTS (select * from REQ.ReceiveRequest r 
		where r.FinancialPeriodID = @FinancialPeriodID and r.Number = @Number)
		BEGIN
			RAISERROR('NumberIsDuplicate',16,12)
			RETURN 0
		END
	End
	
     DECLARE @CompanyID INT,
			@Message NVARCHAR(MAX)
			
	SELECT @CompanyID = CompanyID 
	FROM CFG.Branch 
	WHERE BranchID = @BranchID	
	
	IF(@Number = 0 OR @Number IS NULL)
		SET @Number =ISNULL((SELECT MAX(Number) + 1
						  FROM [REQ].[ReceiveRequest] rr
						  JOIN CFG.Branch b 
						  	ON rr.BranchID = b.BranchID
						  WHERE FinancialPeriodID = @FinancialPeriodID 
						  AND b.CompanyID = @CompanyID
						  ),1)

	SET @Non_Received = @Amount	

	INSERT INTO [REQ].[ReceiveRequest] ([FinancialPeriodID], [Type], [Number], [Date], [BranchID], [PartyID], [CurrencyID], [Amount], [Non_Received], [Description], [Description2], [Status], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate],[OrganizationUnitID],[ReviewDate],[Reviewer])
	SELECT @FinancialPeriodID, @Type, @Number, @Date, @BranchID, @PartyID, @CurrencyID, @Amount, @Non_Received, @Description, @Description2, @Status,  0, @Creator, @CreationDate, @Creator, @CreationDate,@OrganizationUnitID,@ReviewDate,@Reviewer
	
		-- Begin Return Select <- do not remove
		SELECT [ReceiveRequestID],[Version],  [Number], [Non_Received]
		FROM   [REQ].[ReceiveRequest]
		WHERE  [ReceiveRequestID] = SCOPE_IDENTITY()
		-- End Return Select <- do not remove

END ;
