
CREATE PROC [POS].[spRestaurantTableDelete]
    @RestaurantTableID INT ,
    @Version INT
AS
    SET NOCOUNT ON;


    IF @Version = (   SELECT [Version]
                      FROM   [POS].[RestaurantTable]
                      WHERE  [RestaurantTableID] = @RestaurantTableID )
        BEGIN



            DELETE FROM [POS].[RestaurantTable]
            WHERE [RestaurantTableID] = @RestaurantTableID;

        END;
    ELSE
        BEGIN

            RAISERROR(N'Delete_%s_%d.' ,   -- Message text.
                      16 ,                 -- Severity,
                      10 ,                 -- State,
                      N'RestaurantTable' , -- First argument.
                      @RestaurantTableID); -- Second argument.)
        END;
