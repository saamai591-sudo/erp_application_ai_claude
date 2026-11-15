CREATE     PROC [SLE].[spPourcentageParameterUpdate]
    @PourcentageParameterID INT ,
    @Code INT ,
    @Title NVARCHAR(500) ,
    @Title2 NVARCHAR(500) ,
    @Type TINYINT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT
AS
    SET NOCOUNT ON;

    IF @Version = (   SELECT [Version]
                      FROM   [SLE].[PourcentageParameter]
                      WHERE  [PourcentageParameterID] = @PourcentageParameterID )
        BEGIN
            IF @Code IS NULL
               OR @Code = 0
                BEGIN
                    SET @Code = ISNULL(
                                (   SELECT MAX(pp.Code)
                                    FROM   SLE.PourcentageParameter AS pp ) ,
                                0) + 1;
                END;

            SET @Version = @Version + 1;

            UPDATE [SLE].[PourcentageParameter]
            SET    [Code] = @Code ,
                   [Title] = @Title ,
                   [Title2] = @Title2 ,
                   [Type] = @Type ,
                   [Creator] = @Creator ,
                   [CreationDate] = @CreationDate ,
                   [LastEditor] = @LastEditor ,
                   [LastEditionDate] = @LastEditionDate ,
                   [Version] = @Version
            WHERE  [PourcentageParameterID] = @PourcentageParameterID;

            -- Begin Return Select <- do not remove
            SELECT  [Version] ,
                    [Code]
            FROM   [SLE].[PourcentageParameter]
            WHERE  [PourcentageParameterID] = @PourcentageParameterID;
        -- End Return Select <- do not remove

        END;
