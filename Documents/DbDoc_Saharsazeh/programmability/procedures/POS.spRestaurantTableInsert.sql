CREATE PROC [POS].[spRestaurantTableInsert]
    @StationID INT ,
    @Title NVARCHAR(255) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (   SELECT 1
                  FROM   POS.RestaurantTable AS rt
                  WHERE  rt.Title = @Title
                         AND rt.StationID = @StationID )
        BEGIN
            RAISERROR('TitleIsDuplicate', 16, 12);
            RETURN;
        END;

    INSERT INTO [POS].[RestaurantTable] ( [StationID] ,
                                          [Title] ,
                                          [Version] ,
                                          [Creator] ,
                                          [CreationDate] ,
                                          [LastEditor] ,
                                          [LastEditionDate] )
                SELECT @StationID ,
                       @Title ,
                       0 ,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate;

    -- Begin Return Select <- do not remove
    SELECT [RestaurantTableID] ,
           [Version] 
    FROM   [POS].[RestaurantTable]
    WHERE  [RestaurantTableID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
END
