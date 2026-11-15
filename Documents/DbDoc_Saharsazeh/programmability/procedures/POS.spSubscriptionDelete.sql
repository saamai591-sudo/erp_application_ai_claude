CREATE PROC [POS].[spSubscriptionDelete]
    @SubscriptionID INT ,
    @Version INT
AS
    SET NOCOUNT ON;


    IF @Version = (   SELECT [Version]
                      FROM   [POS].[Subscription]
                      WHERE  [SubscriptionID] = @SubscriptionID )
        BEGIN



            DELETE FROM [POS].[Subscription]
            WHERE [SubscriptionID] = @SubscriptionID;

        END;
    ELSE
        BEGIN

            RAISERROR(N'Delete_%s_%d.' , -- Message text.
                      16 ,               -- Severity,
                      10 ,               -- State,
                      N'Subscription' ,  -- First argument.
                      @SubscriptionID); -- Second argument.)
        END;
