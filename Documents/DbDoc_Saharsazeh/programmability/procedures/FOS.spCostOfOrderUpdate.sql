CREATE     PROC [FOS].[spCostOfOrderUpdate] 
    @CostOfOrderID int,
	@BranchID int,
    @Date date,
	@BaseType tinyint,
    @ProformaInvoiceID int,
    @RegistrationID int,
    @BillOfLadingID int,
	@ClearanceID int,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
	--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	declare @PreVersion int
	
	Select  @PreVersion = [Version] 
	from [FOS].[CostOfOrder]
	where [CostOfOrderID] = @CostOfOrderID

	if (select count(*) from FOS.CostOfOrderItem 
	    where CostOfOrderID = @CostOfOrderID and PurchaseInvoiceItemID is null) > 0
	begin
		DECLARE @maxDate DATE
		SELECT @maxDate = MAX(EndDate)
		FROM cfg.Vat v
	
		IF @maxDate IS NOT NULL
		   AND @maxDate >= @Date
		BEGIN 	    
			RAISERROR('VatHasPublished', 16, 12)
		END
	end

	if @Version = @PreVersion
	begin	
		set @Version = @Version +1 

		UPDATE [FOS].[CostOfOrder]
		SET     [BranchID] = @BranchID, 
				[Date] = @Date, 
				[BaseType] = @BaseType,
				[ProformaInvoiceID] = @ProformaInvoiceID, 
				[RegistrationID] = @RegistrationID, 
				[BillOfLadingID] = @BillOfLadingID, 
				[ClearanceID] = @ClearanceID,				 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version
		WHERE  [CostOfOrderID] = @CostOfOrderID
	
		-- Begin Return Select <- do not remove
		SELECT [Version], [Number]
		FROM   [FOS].[CostOfOrder]
		WHERE  [CostOfOrderID] = @CostOfOrderID	
		-- End Return Select <- do not remove
	end
ELSE 
	RAISERROR('Version mismatch...', 16 , 10)
