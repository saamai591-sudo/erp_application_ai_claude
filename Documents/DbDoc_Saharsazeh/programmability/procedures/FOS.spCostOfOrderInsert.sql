CREATE   PROC [FOS].[spCostOfOrderInsert]     
    @FinancialPeriodID int,
    @BranchID int,
    @Number int,
    @Date date,
	@BaseType tinyint,
    @ProformaInvoiceID int,
    @RegistrationID int,
    @BillOfLadingID int,
	@ClearanceID int,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	if @Number is null or @Number = 0
	set @Number = isnull((select max(Number) + 1 
							from FOS.CostOfOrder
							 where FinancialPeriodID = @FinancialPeriodID
							 ),1)

	INSERT INTO [FOS].[CostOfOrder] ([FinancialPeriodID], [BranchID], [Number], [Date], [BaseType], [ProformaInvoiceID], 
	[RegistrationID], [BillOfLadingID], [ClearanceID], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @FinancialPeriodID, @BranchID, @Number, @Date, @BaseType, @ProformaInvoiceID,
	@RegistrationID, @BillOfLadingID, @ClearanceID, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [CostOfOrderID], [Version], [Number]
	FROM   [FOS].[CostOfOrder]
	WHERE  [CostOfOrderID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
