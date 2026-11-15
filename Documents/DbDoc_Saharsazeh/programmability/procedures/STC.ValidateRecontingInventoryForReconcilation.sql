 

Create   PROCEDURE STC.ValidateRecontingInventoryForReconcilation
    (
      @RecountingInventoryID INT 
    )
	  --WITH ENCRYPTION
AS
    BEGIN
    
        DECLARE @RecountingInventoryTagID INT ,
            @OrgTurnCount INT ,
            @TurnCount INT= 1;

        SELECT  @OrgTurnCount = i.CountingTurns ,
                @RecountingInventoryTagID = r.RecountingInventoryTagID
        FROM    STC.RecountingInventory r
                JOIN STC.RecountingInventoryTag t ON t.RecountingInventoryTagID = r.RecountingInventoryTagID
                JOIN STC.RecountingInventoryPeriod rip ON t.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID
                JOIN STC.InventoryMethod i ON i.InventoryMethodID = rip.InventoryMethodID
        WHERE   RecountingInventoryID = @RecountingInventoryID;

        DECLARE @tempTable TABLE ( Turn INT, [State] BIT );

        CREATE TABLE #tempTable ( Value INT, Value1 BIT );

        DECLARE @tempTableName NVARCHAR(255) ,
            @query NVARCHAR(MAX);

        WHILE @TurnCount < 4
            BEGIN
				PRINT @TurnCount
                IF ( @TurnCount <= @OrgTurnCount )
                    BEGIN
                        BEGIN
                            SET @tempTableName = CFG.getTempTableName(1);
                            EXEC [STC].[GetRecountingInventoryTagItemsForSelector] @RecountingInventoryTagID = @RecountingInventoryTagID,
                                @RecountingInventoryID = @RecountingInventoryID,
                                @RecountingTurn = @TurnCount,
                                @ValidationTempTable = @tempTableName;
						
                            SET @query = 'IF EXISTS ( SELECT 1 FROM  ' + @tempTableName + ' r where RecountingInventoryTagItemID not in (
											select RecountingInventoryTagItemID from STC.RecountingInventoryItem where Type ='+CAST(@TurnCount AS VARCHAR(1))+' AND  RecountingInventoryID = '+CAST(@RecountingInventoryID AS NVARCHAR(255)) +') )
											begin
												INSERT  #tempTable
												VALUES  ( ' + CAST(@TurnCount AS VARCHAR(1)) + ',
														  0  -- State - bit
														  )
											end
											ELSE
												begin
													INSERT  #tempTable
													VALUES  ( ' + CAST(@TurnCount AS VARCHAR(1)) + ', 1 )
												end'
							EXEC ( @query);
                    
                        END;
		  

                    END;


                SET @TurnCount = @TurnCount + 1;

            END;


        SELECT  *
        FROM    #tempTable;
               
    END;