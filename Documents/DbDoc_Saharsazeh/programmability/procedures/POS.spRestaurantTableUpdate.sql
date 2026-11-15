CREATE PROC [POS].[spRestaurantTableUpdate]
    @RestaurantTableID INT ,
    @StationID INT ,
    @Title NVARCHAR(255) ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    IF EXISTS (   SELECT 1
                  FROM   POS.RestaurantTable AS rt
                  WHERE  rt.Title = @Title
                         AND rt.StationID = @StationID
                         AND [RestaurantTableID] <> @RestaurantTableID )
        BEGIN
            RAISERROR('TitleIsDuplicate', 16, 12);
            RETURN;
        END;

    IF @Version = (   SELECT [Version]
                      FROM   [POS].[RestaurantTable]
                      WHERE  [RestaurantTableID] = @RestaurantTableID )
        BEGIN

            SET @Version = @Version + 1;
            UPDATE [POS].[RestaurantTable]
            SET    [StationID] = @StationID ,
                   [Title] = @Title ,
                   [Version] = @Version ,
                   [Creator] = @Creator ,
                   [CreationDate] = @CreationDate ,
                   [LastEditor] = @LastEditor ,
                   [LastEditionDate] = @LastEditionDate
            WHERE  [RestaurantTableID] = @RestaurantTableID;

            -- Begin Return Select <- do not remove
            SELECT  [Version]
            FROM   [POS].[RestaurantTable]
            WHERE  [RestaurantTableID] = @RestaurantTableID;
        -- End Return Select <- do not remove
        END;
