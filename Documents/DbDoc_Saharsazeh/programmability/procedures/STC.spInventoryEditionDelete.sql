
CREATE     PROC [STC].[spInventoryEditionDelete]
    @InventoryEditionID int,
    @Version INT
AS 
	SET NOCOUNT ON 
	IF @Version <> (   SELECT [Version]
                      FROM   [STC].[InventoryEdition]
                      WHERE  [InventoryEditionID] = @InventoryEditionID )
        BEGIN
		   RAISERROR(N'Delete_%s_%d.' ,   -- Message text.
                      16 ,                 -- Severity,
                      10 ,                 -- State,
                      N'InventoryEdition' , -- First argument.
                      @InventoryEditionID); -- Second argument.)
                      RETURN
        END
        ELSE IF
        
        (SELECT ie.[Status]
          FROM stc.InventoryEdition AS ie WHERE ie.InventoryEditionID=@InventoryEditionID)<>0
          
          BEGIN
          	 RAISERROR('STC_spRecountingInventoryDelete_1' ,   -- Message text.
                      16 ,                 -- Severity,
                      12 ,                 -- State,
                      N'InventoryEdition' , -- First argument.
                      @InventoryEditionID); -- Second argument.)
                      RETURN
          END
          else

		DELETE
			FROM   [STC].[InventoryEdition]
		WHERE  [InventoryEditionID] = @InventoryEditionID 

        
        ;

