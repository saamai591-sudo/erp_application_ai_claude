

create   PROC [PRM].[spCostStructureAccountItemDelete]
    @CostStructureAccountItemID int,
    @Version INT
AS 
SET NOCOUNT ON 
BEGIN TRY

	IF @Version = (   SELECT [Version]
                      FROM   [PRM].[CostStructureAccountItem]
                      WHERE  [CostStructureAccountItemID] = @CostStructureAccountItemID )
        BEGIN

		DELETE
			FROM   [PRM].[CostStructureAccountItem]
		WHERE  [CostStructureAccountItemID] = @CostStructureAccountItemID 

        END;
    ELSE
        BEGIN

            RAISERROR(N'Delete_%s_%d.' ,   -- Message text.
                      16 ,                 -- Severity,
                      10 ,                 -- State,
                      N'CostStructureAccountItem' , -- First argument.
                      @CostStructureAccountItemID); -- Second argument.)
        END;

END TRY
BEGIN CATCH

	DECLARE @ErrorMessage NVARCHAR(4000);
	DECLARE @ErrorSeverity INT;
	DECLARE @ErrorState INT;

	SELECT 
		@ErrorMessage = ERROR_MESSAGE(),
		@ErrorSeverity = ERROR_SEVERITY(),
		@ErrorState = ERROR_STATE();


	if (ERROR_NUMBER()=547)
			set @ErrorState=11
	RAISERROR (@ErrorMessage, -- Message text.
			   @ErrorSeverity, -- Severity.
			   @ErrorState -- State.
			   );
		   
END CATCH
