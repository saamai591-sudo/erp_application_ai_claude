
------------------------------- modify [PRM].spProductionTimingInsert ------------------------------------------------
CREATE     PROC [PRM].spProductionTimingInsert
  ( @StuffID int,
	@CostCenterId int,
	@ProductionTime decimal(18, 0),
	@Quantity decimal(30, 4),
	@CostDriverID int,
    @Creator int,
    @CreationDate datetime
	)
--WITH ENCRYPTION 
AS 
SET NOCOUNT ON
BEGIN TRY

	INSERT INTO PRM.ProductionTiming(StuffID,
	                                 CostCenterId, ProductionTime, Quantity, CostDriverID,
	                                 Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT @StuffID,
	       @CostCenterId, @ProductionTime, @Quantity, @CostDriverID,
	       @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT ProductionTimingID,[Version]
	FROM   PRM.ProductionTiming
	WHERE  ProductionTimingID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

END TRY
BEGIN CATCH

	DECLARE @ErrorMessage NVARCHAR(4000);
	DECLARE @ErrorSeverity INT;
	DECLARE @ErrorState INT;

	SELECT 
		@ErrorMessage = ERROR_MESSAGE(),
		@ErrorSeverity = ERROR_SEVERITY(),
		@ErrorState = ERROR_STATE();

	
	RAISERROR (@ErrorMessage, -- Message text.
			   @ErrorSeverity, -- Severity.
			   @ErrorState -- State.
			   );
				   
END CATCH
