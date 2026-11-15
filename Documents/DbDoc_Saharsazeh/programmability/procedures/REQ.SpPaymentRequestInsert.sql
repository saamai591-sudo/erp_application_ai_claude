
----------------------------------------------------------------------------------------------
CREATE   PROC [REQ].[SpPaymentRequestInsert] 
    @FinancialPeriodID int,
    @Type tinyint,
    @Number int,
    @Date date,
    @BranchID int,
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @Status tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate DATETIME,
	@OrganizationUnitID INT,
	@ReviewDate DATETIME = NULL,
    @Reviewer INT = NULL

--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON 
	
	IF(@Number IS NOT NULL and @Number <> 0)
	Begin
		IF EXISTS (select * from REQ.PaymentRequest p 
		where p.FinancialPeriodID = @FinancialPeriodID and p.Number = @Number)
		BEGIN
			RAISERROR('NumberIsDuplicate',16,12)
			RETURN
		END
	End
	
	DECLARE @CompanyID INT,
			@Message NVARCHAR(MAX)
			
	SELECT @CompanyID = CompanyID 
	FROM CFG.Branch 
	WHERE BranchID = @BranchID	
			
	
	
	IF(@Number = 0 OR @Number IS NULL)
	SET @Number = ISNULL((SELECT MAX(Number) + 1
                      FROM [REQ].[PaymentRequest] pr
					  JOIN CFG.Branch b 
					  	ON pr.BranchID = b.BranchID
					  WHERE FinancialPeriodID = @FinancialPeriodID 
					  AND b.CompanyID = @CompanyID
					  ),1)
   

		INSERT INTO [REQ].[PaymentRequest] ([FinancialPeriodID], [Type], [Number], [Date], [BranchID], [Description],[Description2], [Status], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate],[OrganizationUnitID],[ReviewDate],[Reviewer])
		SELECT @FinancialPeriodID, @Type, @Number, @Date, @BranchID,@Description,@Description2, @Status,  0, @Creator, @CreationDate, @LastEditor, @LastEditionDate,@OrganizationUnitID,@ReviewDate,@Reviewer
	
		-- Begin Return Select <- do not remove
		SELECT [PaymentRequestID], [Version], [Number]
		FROM   [REQ].[PaymentRequest]
		WHERE  [PaymentRequestID] = SCOPE_IDENTITY()
		-- End Return Select <- do not remove
END ;
