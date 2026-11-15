CREATE PROC [POS].[spSubscriptionUpdate]
    @SubscriptionID INT ,
    @StationID INT ,
    @Title NVARCHAR(255) ,
    @Address NVARCHAR(MAX) ,
    @Phone NVARCHAR(20) = NULL ,
    @Mobile NVARCHAR(20) = NULL ,
    @Number INT ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    IF EXISTS (   SELECT 1
                  FROM   POS.Subscription AS s
                  WHERE  s.StationID = @StationID
                         AND s.SubscriptionID <> @SubscriptionID
                         AND (   s.Number = @Number
                                 OR s.Mobile = @Mobile
                                 OR s.Phone = @Phone ))
        BEGIN
            RAISERROR('StoreSale.SubscriptionIsDuplicated', 16, 12);
            RETURN;
        END;

    IF @Number IS NULL
       OR @Number = 0
        SET @Number = ISNULL((   SELECT MAX(s.Number)
                                 FROM   POS.Subscription AS s
                                 WHERE  s.StationID = @StationID ) ,
                             0) + 1;

    IF @Version = (   SELECT [Version]
                      FROM   [POS].[Subscription]
                      WHERE  [SubscriptionID] = @SubscriptionID )
        BEGIN

            SET @Version = @Version + 1;

            UPDATE [POS].[Subscription]
            SET    [StationID] = @StationID ,
                   [Title] = @Title ,
                   [Address] = @Address ,
                   [Phone] = @Phone ,
                   [Mobile] = @Mobile ,
                   [Number] = @Number ,
                   [Version] = @Version ,
                   [Creator] = @Creator ,
                   [CreationDate] = @CreationDate ,
                   [LastEditor] = @LastEditor ,
                   [LastEditionDate] = @LastEditionDate
            WHERE  [SubscriptionID] = @SubscriptionID;

            -- Begin Return Select <- do not remove
            SELECT  [Version],
                   [Number]
            FROM   [POS].[Subscription]
            WHERE  [SubscriptionID] = @SubscriptionID;
        -- End Return Select <- do not remove
        END;
