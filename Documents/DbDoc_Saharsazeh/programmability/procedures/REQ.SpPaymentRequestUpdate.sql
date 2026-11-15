
----------------------------------------------------------------------------------------------
CREATE   PROC [REQ].[SpPaymentRequestUpdate] 
    @PaymentRequestID int,
    @FinancialPeriodID int,
    @Type tinyint,
    @Number int,
    @Date date,
    @BranchID int,
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @Status tinyint,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate DATETIME,
	@OrganizationUnitID INT,
	@ReviewDate DATETIME NULL,
    @Reviewer INT NULL

--WITH ENCRYPTION 
AS
BEGIN
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [REQ].[PaymentRequest]
				where [PaymentRequestID] = @PaymentRequestID)
	RAISERROR('Version mismatch...', 16 , 10)

	set @Version = @Version +1
	
	
	DECLARE @CompanyID INT,
			@Message NVARCHAR(MAX)
			
	SELECT @CompanyID = CompanyID 
	FROM CFG.Branch 
	WHERE BranchID = @BranchID	
	
	
	IF(@Number IS NOT NULL and @Number <> 0)
	Begin
		IF EXISTS (select * from REQ.PaymentRequest p 
					JOIN CFG.Branch b 
						ON p.BranchID = b.BranchID
		where p.PaymentRequestID <> @PaymentRequestID 
		AND p.FinancialPeriodID = @FinancialPeriodID 
		AND b.CompanyID = @CompanyID
		AND p.Number = @Number)
		BEGIN
			RAISERROR('NumberIsDuplicate',16,12)
			RETURN 0
		END
	End		
	
	IF(@Number = 0 OR @Number IS NULL)
	SET @Number = ISNULL((SELECT MAX(Number) + 1
                      FROM [REQ].[PaymentRequest] pr
					  JOIN CFG.Branch b 
					  	ON pr.BranchID = b.BranchID
					  WHERE FinancialPeriodID = @FinancialPeriodID 
					  AND b.CompanyID = @CompanyID
					  ),1)
      

		UPDATE [REQ].[PaymentRequest]
		SET    [FinancialPeriodID] = @FinancialPeriodID,
			   [Type] = @Type, [Number] = @Number,
		       [Date] = @Date, [BranchID] = @BranchID, 
		       [Description] = @Description,
		       [Description2] = @Description2, 
		       [Status] = @Status,
		       [Version] = @Version,
		       [Creator] = @Creator,
		       [CreationDate] = @CreationDate, 
		       [LastEditor] = @LastEditor, 
		       [LastEditionDate] = @LastEditionDate,
			   [OrganizationUnitID] = @OrganizationUnitID,
			   [ReviewDate]=@ReviewDate,
			   [Reviewer]=@Reviewer
		WHERE  [PaymentRequestID] = @PaymentRequestID
	
		-- Begin Return Select <- do not remove
		SELECT  p.[Version] , [Number]
        FROM   [REQ].[PaymentRequest] p
		WHERE  [PaymentRequestID] = @PaymentRequestID	
		-- End Return Select <- do not remove 
END;
