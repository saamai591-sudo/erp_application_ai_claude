CREATE PROC [CFG].[sp_readerrorlog]( 
   @p1     INT = 0, 
   @p2     INT = NULL, 
   @p3     VARCHAR(255) = NULL, 
   @p4     VARCHAR(255) = NULL) 
AS 
BEGIN 

   IF (NOT IS_SRVROLEMEMBER(N'securityadmin') = 1) 
   BEGIN 
      RAISERROR(15003,-1,-1, N'securityadmin') 
      RETURN (1) 
   END 
    
   IF (@p2 IS NULL) 
       EXEC sys.xp_readerrorlog @p1 
   ELSE 
       EXEC sys.xp_readerrorlog @p1,@p2,@p3,@p4 
END
