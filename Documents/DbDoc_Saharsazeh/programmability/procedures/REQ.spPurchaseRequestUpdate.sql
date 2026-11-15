
----------------------------------------------------------------------------------------------
CREATE   PROC [REQ].[spPurchaseRequestUpdate] 
    @PurchaseRequestID int,
    @BranchID int,
    @PurchaseRequestNumber int,
    @PurchaseRequestDate datetime,
    @PurchaseRequestState tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
    @FinancialPeriodID int,
	@OrganizationUnitID INT,
	@BaseDocument INT,
	@ReviewDate DATETIME NULL,
    @Reviewer INT NULL
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [REQ].[PurchaseRequest]
	where [PurchaseRequestID] = @PurchaseRequestID)
	RAISERROR('Version mismatch...', 16 , 10)
	
	DECLARE 
			@CompanyID INT,
	        @Message NVARCHAR(MAX);
			
	SELECT @CompanyID = CompanyID 
	FROM CFG.Branch 
	WHERE BranchID = @BranchID	
		
	IF (@PurchaseRequestNumber = 0 OR @PurchaseRequestNumber IS NULL)
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
		IF (Exists (SELECT 1
					FROM [REQ].[PurchaseRequest] pr
					JOIN CFG.Branch b 
						ON pr.BranchID = b.BranchID
					WHERE FinancialPeriodID = @FinancialPeriodID 
					AND b.CompanyID = @CompanyID
					AND pr.PurchaseRequestNumber = @PurchaseRequestNumber
					AND pr.PurchaseRequestID != @PurchaseRequestID
					)) 
		begin
			SELECT @Message = 'NumberIsDuplicate'
			RAISERROR(@Message,16,12)
			Return
		end
	END
			
	UPDATE [REQ].[PurchaseRequest]
	SET     [BranchID] = @BranchID, 
			[PurchaseRequestNumber] = @PurchaseRequestNumber, 
			[PurchaseRequestDate] = @PurchaseRequestDate, 
			[PurchaseRequestState] = @PurchaseRequestState, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate, 
			[Version] = @Version + 1,
			[OrganizationUnitID] =@OrganizationUnitID,
			[BaseDocument] =@BaseDocument,
			[ReviewDate]=@ReviewDate,
			[Reviewer]=@Reviewer
	WHERE  [PurchaseRequestID] = @PurchaseRequestID

	-- Begin Return Select <- do not remove
	SELECT  [Version] ,
			[PurchaseRequestNumber]
    FROM   [REQ].[PurchaseRequest]
	WHERE  [PurchaseRequestID] = @PurchaseRequestID	
	-- End Return Select <- do not remove
END
