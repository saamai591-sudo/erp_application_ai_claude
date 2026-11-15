CREATE PROC [POS].[spSubscriptionInsert]
    @StationID INT ,
    @Title NVARCHAR(255) ,
    @Address NVARCHAR(MAX) ,
    @Phone NVARCHAR(20) = NULL ,
    @Mobile NVARCHAR(20) = NULL ,
    @Number INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    IF EXISTS (   SELECT 1
                  FROM   POS.Subscription AS s
                  WHERE  s.StationID = @StationID
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

    INSERT INTO [POS].[Subscription] ( [StationID] ,
                                       [Title] ,
                                       [Address] ,
                                       [Phone] ,
                                       [Mobile] ,
                                       [Number] ,
                                       [Version] ,
                                       [Creator] ,
                                       [CreationDate] ,
                                       [LastEditor] ,
                                       [LastEditionDate] )
                SELECT @StationID ,
                       @Title ,
                       @Address ,
                       @Phone ,
                       @Mobile ,
                       @Number ,
                       0 ,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate;

    -- Begin Return Select <- do not remove
    SELECT [SubscriptionID] ,
           [Version] ,
           [Number] 
    FROM   [POS].[Subscription]
    WHERE  [SubscriptionID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
