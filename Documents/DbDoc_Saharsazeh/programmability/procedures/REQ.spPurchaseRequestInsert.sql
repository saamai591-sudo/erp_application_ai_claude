
----------------------------------------------------------------------------------------------
CREATE   PROC [REQ].[spPurchaseRequestInsert] 
    @BranchID int,
    @PurchaseRequestNumber int,
    @PurchaseRequestDate datetime,
    @PurchaseRequestState tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @FinancialPeriodID INT,
	@OrganizationUnitID INT,
	@BaseDocument INT,
    @ReviewDate DATETIME NULL,
    @Reviewer INT NULL

--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 

	DECLARE 
		@CompanyID INT;	
			
	SELECT @CompanyID = CompanyID 
	FROM CFG.Branch 
	WHERE BranchID = @BranchID	
	
	IF (@PurchaseRequestNumber = 0 OR @PurchaseRequestNumber IS NULL)--شماره گذاري سيستمي يا اگر دستي بود ولي مقدار را وارد نکرده بود
	BEGIN
		SET @PurchaseRequestNumber = ISNULL((
											SELECT MAX(PurchaseRequestNumber) + 1
											FROM [REQ].[PurchaseRequest] pr
											JOIN CFG.Branch b 
												ON pr.BranchID = b.BranchID
											WHERE FinancialPeriodID = @FinancialPeriodID 
											AND b.CompanyID = @CompanyID
											),1)
	END
	ELSE
	BEGIN
		IF (Exists (SELECT * 
					FROM [REQ].[PurchaseRequest] pr
					JOIN CFG.Branch b 
						ON pr.BranchID = b.BranchID
					WHERE FinancialPeriodID = @FinancialPeriodID 
					AND b.CompanyID = @CompanyID)) 
		begin
			DECLARE @Message NVARCHAR(MAX)
	
			SELECT @Message = 'NumberIsDuplicate'
			RAISERROR(@Message,16,12)
			--RAISERROR('شماره سند تکراري است', 16, 14)
			Return 0
		end
	END
		

	INSERT INTO [REQ].[PurchaseRequest] (
		[BranchID], 
		[PurchaseRequestNumber], 
		[PurchaseRequestDate], 
		[PurchaseRequestState], 
		[Creator], 
		[CreationDate], 
		[LastEditor], 
		[LastEditionDate], 
		[Version], 
		[FinancialPeriodID],
		[OrganizationUnitID],
		[BaseDocument],
		[ReviewDate],
		[Reviewer]
	)
	SELECT 
		@BranchID, 
		@PurchaseRequestNumber, 
		@PurchaseRequestDate, 
		@PurchaseRequestState, 
		@Creator, 
		@CreationDate, 
		@LastEditor, 
		@LastEditionDate, 
		0, 
		@FinancialPeriodID,
		@OrganizationUnitID,
		@BaseDocument,
		@ReviewDate,
		@Reviewer
	
	-- Begin Return Select <- do not remove
	SELECT	[PurchaseRequestID], 
			[Version],  
			[PurchaseRequestNumber]
	FROM   [REQ].[PurchaseRequest]
	WHERE  [PurchaseRequestID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
	
END;
