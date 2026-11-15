
--==============================================Alter spOrderPricingUpdate
CREATE   PROC FOS.spOrderPricingUpdate
    @OrderPricingID INT,
    @Number INT,
    @Date DATE,
    @BranchID INT,
    @ClearanceID INT,    
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON

	DECLARE 
		@PreVersion INT,
		@FinancialPeriodID INT

	SELECT  
		@PreVersion = [Version],
		@FinancialPeriodID = FinancialPeriodID
	FROM 
		FOS.OrderPricing
	WHERE 
		OrderPricingID = @OrderPricingID
	
	IF @Version = @PreVersion
	BEGIN	
		SET 
			@Version = @Version + 1 

		DECLARE 
			@CompanyID INT

		SELECT 
			@CompanyID = b.CompanyID 
		FROM 
			CFG.Branch b 
		WHERE 
			b.BranchID = @BranchID
	
		IF(@Number = 0 OR @Number IS NULL)
		SET 
			@Number = ISNULL(
							(SELECT 
								MAX(Number) + 1
							 FROM 
								FOS.OrderPricing op
							 JOIN 
								CFG.Branch b 
							 ON 
								op.BranchID = b.BranchID
							 WHERE 
								op.FinancialPeriodID = @FinancialPeriodID AND 
								b.CompanyID = @CompanyID)
							, 1) 
		UPDATE 
			[FOS].[OrderPricing]
		SET    
			[Number] = @Number, 
			[Date] = @Date, 
			[BranchID] = @BranchID,
			[ClearanceID] = @ClearanceID, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate, 
			[Version] = @Version
		WHERE  
			[OrderPricingID] = @OrderPricingID
	
		-- Begin Return Select <- do not remove
		SELECT 
			[Version],
			[Number]
		FROM   
			[FOS].[OrderPricing]
		WHERE  
			[OrderPricingID] = @OrderPricingID	
		-- End Return Select <- do not remove
	END
	ELSE 
		RAISERROR('Version mismatch...', 16 , 10)
