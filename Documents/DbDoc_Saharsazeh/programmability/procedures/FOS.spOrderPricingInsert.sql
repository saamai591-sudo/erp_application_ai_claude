
--==============================================Alter spOrderPricingInsert
CREATE   PROC [FOS].[spOrderPricingInsert]    
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @BranchID INT,
    @ClearanceID INT,    
    @Creator INT,
    @CreationDate DATETIME
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON   
	BEGIN TRY
		IF EXISTS(SELECT * FROM FOS.OrderPricing WHERE ClearanceID = @ClearanceID)
		BEGIN
			RAISERROR('ترخیص انتخاب شده قبلا قیمت گذاری شده است.',16,12)
			RETURN
		END

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

		INSERT INTO 
			[FOS].[OrderPricing] ([FinancialPeriodID], [Number], [Date], [BranchID], [ClearanceID], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
		SELECT 
			@FinancialPeriodID, @Number, @Date, @BranchID, @ClearanceID, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
		-- Begin Return Select <- do not remove
		SELECT 
			[OrderPricingID],
			[Version],
			[Number]
		FROM   
			[FOS].[OrderPricing]
		WHERE  
			[OrderPricingID] = SCOPE_IDENTITY()
		-- End Return Select <- do not remove
	END TRY
	BEGIN CATCH
		DECLARE 
			@ErrorMessage NVARCHAR(4000),
			@ErrorSeverity INT,
			@ErrorState INT

		SELECT 
			@ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();
	
		RAISERROR (@ErrorMessage, -- Message text.
				   @ErrorSeverity, -- Severity.
				   @ErrorState -- State.
				   );
	END CATCH
