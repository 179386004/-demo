using AutoMapper;
using System.IO;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using View.Models;
using Entites.Models;
using View.Models.PrintCenter;
using View.Models.DesignCenter;
using DAL.BaseDAL;
using Microsoft.AspNetCore.Authorization;
using GLB.Global;
using Common;
using PMT.Controllers.KCGL;
using Newtonsoft.Json;
using DTSystem = System;
using System.Threading;
using System.Text;

namespace PMT.Controllers
{
    /// <summary>
    /// 设计中心
    /// </summary>
    [Route("api/[Controller]/[Action]")]
    [Authorize]
    [ApiController]
    public class PrintCenterController : BaseApiController
    {
        private readonly IMapper _mapper;
        private readonly SqlDBContext db;
        public ProcessStepsServices ProcessSteps = new ProcessStepsServices();
        public PrintCenterController(IMapper mapper, IOptions<AppSettingModel> appSettingModel) : base(appSettingModel)
        {
            _mapper = mapper;
            db = new SqlDBContext();
        }

        public void UploadController()
        {
            // 创建存储目录（如果不存在）
            if (!Directory.Exists(AppsettingsHelper.Configuration["Doc_File"]))
            {
                Directory.CreateDirectory(AppsettingsHelper.Configuration["Doc_File"]);
            }
        }

        [HttpPost]
        public async Task<IActionResult> UploadFileChunk([FromForm] UploadModel model)
        {
            var orderDataJson = Request.Form["OrderData"].ToString();
            var orderData = JsonConvert.DeserializeObject<CreateOrderModel>(orderDataJson);

            // 创建存储目录（如果不存在）
            var storagePath = AppsettingsHelper.Configuration["Doc_File"];
            if (!Directory.Exists(storagePath))
            {
                Directory.CreateDirectory(storagePath);
            }

            // 分片文件命名：使用 fileId 和 ChunkIndex 确保唯一性
            var chunkFileName = $"{model.FileId}_chunk_{model.ChunkIndex}";
            var tempFilePath = Path.Combine(storagePath, chunkFileName);

            // 保存当前分片文件
            using (var stream = new FileStream(tempFilePath, FileMode.Create))
            {
                await model.fileChunk[0].CopyToAsync(stream); // 假设只上传一个分片
            }

            // 检查是否所有分片都已上传完毕
            if (model.ChunkIndex == model.TotalChunks - 1)
            {
                // 生成最终合并后的文件名（与分片文件名不同）
                string uuid =  PublicApiController.CreateGuid();
      
                var finalFileName = $"{uuid}{Path.GetExtension(model.FileName)}";
                var finalFilePath = Path.Combine(storagePath, finalFileName);

                // 合并所有分片
                using (var finalStream = new FileStream(finalFilePath, FileMode.Create))
                {
                    for (int i = 0; i < model.TotalChunks; i++)
                    {
                        var chunkPath = Path.Combine(storagePath, $"{model.FileId}_chunk_{i}");

                        // 检查分片文件是否存在
                        if (!DTSystem.IO.File.Exists(chunkPath))
                        {
                            return BadRequest($"Chunk {i} is missing. File: {chunkPath}");
                        }

                        // 读取分片并写入到最终文件
                        using (var chunkStream = new FileStream(chunkPath, FileMode.Open))
                        {
                            await chunkStream.CopyToAsync(finalStream);
                        }

                        // 删除已合并的分片文件
                        DTSystem.IO.File.Delete(chunkPath);
                    }
                }

                // 保存文件信息到数据库
                var oUploadInfo = new OUploadInfo
                {
                    Id = PublicApiController.CreateGuid(),
                    FileName = Path.GetFileName(finalFilePath),
                    FilePath = finalFilePath,
                    UpLoaderId = CurrentUser.Id,
                    UpLoaderName = CurrentUser.Name,
                    UpLoaderAccount = CurrentUser.Account,
                    UploadDate = DateTime.Now,
                    Status = 1,
                    Description = orderData.Description,
                    OrganizationId = CurrentUser.OrganizationId,
                    ProductName = orderData.ProductName,
                    PatientName = orderData.PatientName,
                    CreateAccount = CurrentUser.Account,
                    CreateDate = DateTime.Now
                };

                db.OUploadInfos.Add(oUploadInfo);
                await db.SaveChangesAsync();

                return Ok(new
                {
                    message = "Files uploaded successfully.",
                    fileName = oUploadInfo.FileName
                });
            }

            return Ok(new { message = "Chunk uploaded successfully." });
        }




    }
}
